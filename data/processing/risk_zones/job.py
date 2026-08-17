"""Risk zones job — Фаза 1 (batch, дневен ритъм).

Събира входовете → смята риск клас по точка → записва полигони в `zones` (PostGIS):
  - FWI   (TimescaleDB `fire_weather_index`)
  - NDVI  (последния растер в MinIO `processed-products/ndvi/`)
  - fuel  (placeholder, докато реалната FirEUrisk карта се зареди)

Идемпотентен за деня: трие зоните за днешната дата и ги записва наново.
"""
import logging
import os
import tempfile
import time
from datetime import date, timedelta

import psycopg
import rasterio

from config import postgres_dsn, timescale_dsn, s3_client
from risk_model import risk_class, risk_score

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("risk-zones")

PRODUCTS_BUCKET = "processed-products"
FUEL_KEY = "fuel/bg_fuel.tif"  # EFFIS NFFL fuel карта, изрязана за България
CELL_HALF_DEG = 0.036          # ~8 km / 2, за квадратна клетка около точката

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
    with tdb.cursor() as cur:
        cur.execute(
            """
            SELECT lat, lon, fwi, class
            FROM fire_weather_index
            WHERE time::date = (SELECT max(time::date) FROM fire_weather_index)
            """
        )
        return cur.fetchall()


def cell_wkt(lon, lat, h):
    return (
        f"POLYGON(({lon - h} {lat - h}, {lon + h} {lat - h}, "
        f"{lon + h} {lat + h}, {lon - h} {lat + h}, {lon - h} {lat - h}))"
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

    with psycopg.connect(postgres_dsn()) as pdb:
        with pdb.cursor() as cur:
            cur.execute("DELETE FROM zones WHERE valid_date = %s", (today,))
            cur.execute(
                "DELETE FROM zones WHERE valid_date < %s",
                (today - timedelta(days=RETENTION_DAYS),),
            )
            for lat, lon, fwi, fclass in points:
                ndvi_mean = sample_ndvi(ndvi, lon, lat)
                fuel_code = sample_fuel(fuel, lon, lat)
                rc = risk_class(fclass, ndvi_mean, fuel_code)
                rs = risk_score(fclass, ndvi_mean, fuel_code)
                cur.execute(
                    INSERT_SQL,
                    (cell_wkt(lon, lat, CELL_HALF_DEG), fclass, fwi,
                     ndvi_mean, fuel_code, rc, rs, today),
                )
        pdb.commit()

    log.info("Записах %d риск зони за %s", len(points), today)


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
