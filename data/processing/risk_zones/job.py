"""Risk zones job — Фаза 1 (batch, дневен ритъм).

Събира входовете → смята риск клас по точка → записва полигони в `zones` (PostGIS):
  - FWI   (TimescaleDB `fire_weather_index`)
  - NDVI  (последния растер в MinIO `processed-products/ndvi/`)
  - fuel  (placeholder, докато реалната FirEUrisk карта се зареди)

Идемпотентен за деня: трие зоните за днешната дата и ги записва наново.
"""
import json
import logging
import os
import tempfile
import time
from datetime import date, timedelta
from pathlib import Path

import psycopg
import rasterio

from config import postgres_dsn, timescale_dsn, s3_client
from risk_model import risk_class, risk_score

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("risk-zones")

PRODUCTS_BUCKET = "processed-products"
FUEL_KEY = "fuel/bg_fuel.tif"  # EFFIS NFFL fuel карта, изрязана за България

# Резервна половин-стъпка, ако решетката е толкова рядка, че стъпката не се извежда.
CELL_HALF_DEG_FALLBACK = 0.036

BORDER_FILE = Path(__file__).parent / "bulgaria_border.json"

# 0 = еднократно пускане (за ръчен run и backfill). Стойност > 0 включва вграден
# планировчик, за да не зависи дневният ритъм от cron на хоста — той не е част от
# репото и затова просто липсваше, а `zones` стоеше празна.
INTERVAL_SECONDS = int(os.getenv("RISK_ZONES_INTERVAL_SECONDS", "0"))

# Всеки ден се пише като отделен `valid_date`, а само днешният се трие преди запис,
# така че без таван старите дни се трупат вечно.
RETENTION_DAYS = int(os.getenv("RISK_ZONES_RETENTION_DAYS", "7"))

INSERT_SQL = """
    INSERT INTO zones
        (geom, fwi_class, fwi_value, ndvi_mean, fuel_type, risk_class, risk_score, computed_at, valid_date)
    VALUES
        (ST_GeomFromText(%s, 4326), %s, %s, %s, %s, %s, %s, NOW(), %s)
"""


def load_ndvi(s3):
    """Връща (dataset, band_array) за най-новия NDVI растер, или None."""
    resp = s3.list_objects_v2(Bucket=PRODUCTS_BUCKET, Prefix="ndvi/")
    keys = [o["Key"] for o in resp.get("Contents", []) if o["Key"].endswith(".tif")]
    if not keys:
        log.warning("Няма NDVI растер в MinIO — ndvi_mean ще е NULL")
        return None
    key = sorted(keys)[-1]
    tmp = tempfile.NamedTemporaryFile(suffix=".tif", delete=False)
    s3.download_file(PRODUCTS_BUCKET, key, tmp.name)
    log.info("Ползвам NDVI растер: %s", key)
    ds = rasterio.open(tmp.name)
    return ds, ds.read(1)


def sample_ndvi(ndvi, lon, lat):
    if ndvi is None:
        return None
    ds, arr = ndvi
    b = ds.bounds
    if not (b.left <= lon <= b.right and b.bottom <= lat <= b.top):
        return None  # точката е извън растера
    row, col = ds.index(lon, lat)
    try:
        return float(arr[row, col])
    except IndexError:
        return None


def load_fuel(s3):
    """Връща (dataset, band_array) за fuel картата на България, или None."""
    try:
        tmp = tempfile.NamedTemporaryFile(suffix=".tif", delete=False)
        s3.download_file(PRODUCTS_BUCKET, FUEL_KEY, tmp.name)
    except Exception:  # noqa: BLE001
        log.warning("Няма fuel карта (%s) — fuel_type ще е NULL", FUEL_KEY)
        return None
    log.info("Ползвам fuel карта: %s", FUEL_KEY)
    ds = rasterio.open(tmp.name)
    return ds, ds.read(1)


def sample_fuel(fuel, lon, lat):
    """NFFL fuel код в точката (0 = негоримо), или None извън покритие."""
    if fuel is None:
        return None
    ds, arr = fuel
    b = ds.bounds
    if not (b.left <= lon <= b.right and b.bottom <= lat <= b.top):
        return None
    row, col = ds.index(lon, lat)
    try:
        return int(arr[row, col])
    except IndexError:
        return None


def fwi_points(tdb):
    """Най-новата стойност за всяка точка от последния ден с данни.

    DISTINCT ON е задължително: `fire_weather_index` няма уникален индекс, а
    `@Scheduled` в EffisDownloaderService гърми веднага при старт на контейнера,
    така че всеки деплой добавя още едно пълно копие на решетката за същия ден.
    Без това всяка клетка се записваше и рисуваше по два пъти.
    """
    with tdb.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT ON (lat, lon) lat, lon, fwi, class
            FROM fire_weather_index
            WHERE time::date = (SELECT max(time::date) FROM fire_weather_index)
            ORDER BY lat, lon, time DESC
            """
        )
        return cur.fetchall()


def _half_step(values):
    """Половината от най-малкото разстояние между съседни стойности.

    Взима се минимумът, а не средното: downloader-ът пропуска точки без FWI
    стойност, а получените двойни дупки иначе се брояха за стъпка на решетката.
    """
    steps = [b - a for a, b in zip(values, values[1:]) if b > a]
    return min(steps) / 2 if steps else CELL_HALF_DEG_FALLBACK


def grid_half_steps(points):
    """Половин-стъпка поотделно по дължина и ширина.

    Клетката трябва да съвпада с решетката, от която идва. Една обща константа за
    двете оси оставяше ~2 км празнина между всяка двойка колони, защото градус
    дължина покрива по-малко земя от градус ширина на тази ширина. Извежда се от
    самите данни, за да преживее промяна в резолюцията на EFFIS.
    """
    lats = sorted({round(p[0], 6) for p in points})
    lons = sorted({round(p[1], 6) for p in points})
    return _half_step(lons), _half_step(lats)


def load_border():
    with BORDER_FILE.open(encoding="utf-8") as fh:
        rings = json.load(fh)["geometry"]["coordinates"]
    xs = [x for ring in rings for x, _ in ring]
    ys = [y for ring in rings for _, y in ring]
    return rings, (min(xs), min(ys), max(xs), max(ys))


def in_bulgaria(lon, lat, border):
    """Ray casting — същата проверка, която картата прави за детекциите.

    Решетката на EFFIS е правоъгълник над цяла Югоизточна Европа, така че без това
    зоните покриваха Сърбия, Румъния, Гърция и Черно море.
    """
    rings, (min_x, min_y, max_x, max_y) = border
    if not (min_x <= lon <= max_x and min_y <= lat <= max_y):
        return False

    inside = False
    for ring in rings:
        j = len(ring) - 1
        for i, (xi, yi) in enumerate(ring):
            xj, yj = ring[j]
            if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
    return inside


def cell_wkt(lon, lat, h_lon, h_lat):
    return (
        f"POLYGON(({lon - h_lon} {lat - h_lat}, {lon + h_lon} {lat - h_lat}, "
        f"{lon + h_lon} {lat + h_lat}, {lon - h_lon} {lat + h_lat}, "
        f"{lon - h_lon} {lat - h_lat}))"
    )


def main() -> None:
    s3 = s3_client()
    ndvi = load_ndvi(s3)
    fuel = load_fuel(s3)
    today = date.today()

    with psycopg.connect(timescale_dsn()) as tdb:
        points = fwi_points(tdb)
    if not points:
        log.warning("Няма FWI точки — нищо за смятане")
        return

    h_lon, h_lat = grid_half_steps(points)
    border = load_border()
    inside = [(lat, lon, fwi, fclass) for lat, lon, fwi, fclass in points if in_bulgaria(lon, lat, border)]

    log.info(
        "Решетка %.5f×%.5f°; %d от %d точки са в България",
        h_lon * 2, h_lat * 2, len(inside), len(points),
    )
    if not inside:
        log.warning("Нито една FWI точка не попада в България — нищо за записване")
        return

    with psycopg.connect(postgres_dsn()) as pdb:
        with pdb.cursor() as cur:
            cur.execute("DELETE FROM zones WHERE valid_date = %s", (today,))
            cur.execute(
                "DELETE FROM zones WHERE valid_date < %s",
                (today - timedelta(days=RETENTION_DAYS),),
            )
            for lat, lon, fwi, fclass in inside:
                ndvi_mean = sample_ndvi(ndvi, lon, lat)
                fuel_code = sample_fuel(fuel, lon, lat)
                rc = risk_class(fclass, ndvi_mean, fuel_code)
                rs = risk_score(fclass, ndvi_mean, fuel_code)
                cur.execute(
                    INSERT_SQL,
                    (cell_wkt(lon, lat, h_lon, h_lat), fclass, fwi,
                     ndvi_mean, fuel_code, rc, rs, today),
                )
        pdb.commit()

    log.info("Записах %d риск зони за %s", len(inside), today)


def run_forever(interval: int) -> None:
    """Смята зоните на фиксиран ритъм.

    Провален цикъл НЕ спира графика: следващото публикуване на FWI е по-добро
    възстановяване от мъртъв контейнер, а рестарт би довел до незабавен повторен
    опит в цикъл вместо изчакване.
    """
    log.info("Планировчик: преизчислявам риск зоните на всеки %d s", interval)
    while True:
        try:
            main()
        except Exception:  # noqa: BLE001 — цикълът трябва да преживее всяка грешка
            log.exception("Риск зоните не бяха преизчислени; следващ опит след %d s", interval)
        time.sleep(interval)


if __name__ == "__main__":
    if INTERVAL_SECONDS > 0:
        run_forever(INTERVAL_SECONDS)
    else:
        main()
