"""Producer за `analysis.tasks` — истинска двойка Sentinel-2 сцени за изгорял участък.

Заменя `mock_publisher.py` с реални данни: намира къде е горяло по детекциите в
`active_fires`, избира най-близките достатъчно безоблачни сцени преди и след пожара,
сваля само каналите, които dNBR ползва (B08 NIR и B12 SWIR2), качва ги в MinIO и
публикува задачата по контракта (раздел 10 на `shared/schemas/message-contracts.md`).

Това НЕ е producer-ът, който контрактът предвижда — онзи е на бекенда и се пуска сам,
когато пожар угасне. Този се пуска на ръка за конкретен участък и служи, докато другият
го няма. Съобщението е същото, така че бекендът може да го замести без промяна в worker-а.

**Защо не преизползва `SentinelFetcherService`:** той сваля B04 + B08 (за NDVI), а dNBR
иска B08 + B12 и го проверява изрично — нито една вече свалена сцена не става за тук.

Пуска се в мрежата на compose, защото MinIO (9000) и RabbitMQ (5672) са вързани за
loopback на хоста:

    docker compose -f docker-compose.yml -f docker-compose.jobs.yml \\
        run --rm dnbr-scene-fetcher \\
        python dnbr/fetch_scene_pair.py --since 2026-08-15 --until 2026-08-21

    # без да се харчи квота — само показва какво би свалил
    ... --since 2026-08-15 --until 2026-08-21 --dry-run

    # ръчно зададен участък, без търсене в базата
    ... --bbox 25.60 41.80 25.80 41.95 --pre 2026-08-08 --post 2026-08-22
"""
import argparse
import json
import logging
import math
import os
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pika
import psycopg
import rasterio

from config import postgres_dsn, rabbitmq_params, s3_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("dnbr-scene-pair")

TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
CATALOG_URL = "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search"
PROCESS_URL = "https://sh.dataspace.copernicus.eu/process/v1"
COLLECTION = "sentinel-2-l2a"

SOURCE_BUCKET = "satellite-imagery"
EXCHANGE = "analysis.exchange"
ROUTING_KEY = "analysis.tasks"

# Редът тук е редът, в който worker-ът чете каналите (`bands.index(...) + 1`).
BANDS = ["B08", "B12"]

METERS_PER_DEGREE = 111_320.0

# Process API отказва заявка над 2500 пиксела на страна, а worker-ът отказва сцена над
# 20 MP (`DNBR_MAX_MEGAPIXELS`). Едно голямо пожарище опира в по-малкото от двете, затова
# резолюцията се отпуска автоматично вместо заявката да гръмне след минута чакане.
MAX_DIMENSION = 2500
MAX_MEGAPIXELS = 20.0

# B12 е с 20 м на пиксел в оригинала; по-ситно от това не добавя информация за dNBR,
# само тегло на растера.
DEFAULT_METRES = 20.0

# Празните пиксели излизат нули, а worker-ът прави 0/0 → NaN (виж `normalized_burn_ratio`),
# тоест те не разреждат статистиките с фалшива „незасегната" площ. Затова тук се проверява
# само дали изобщо си струва да се пуска задачата.
EVALSCRIPT = """//VERSION=3
function setup() {
  return {
    input: ["B08", "B12", "dataMask"],
    output: { bands: 2, sampleType: "FLOAT32" }
  }
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0]
  return [sample.B08, sample.B12]
}
"""

# Детекциите на един пожар идват на порции от няколко прелитания; 0.05° е ~5 км, което ги
# събира в едно петно, без да слепва два различни пожара в съседни долини.
CLUSTER_EPS_DEGREES = 0.05

# Пожарището почти никога не съвпада с точките на детекциите — те са центровете на
# горещите пиксели, а не очертанието. Буферът дава на анализа и периферията.
BBOX_BUFFER_DEGREES = 0.02

FIND_BURN_SQL = """
    WITH detections AS (
        SELECT id, geom, detected_at, frp,
               ST_ClusterDBSCAN(geom, eps := %(eps)s, minpoints := 2) OVER () AS cluster
        FROM active_fires
        WHERE detected_at >= %(since)s AND detected_at < %(until)s
    )
    SELECT count(*)                                        AS detections,
           min(detected_at)::date                          AS first_seen,
           max(detected_at)::date                          AS last_seen,
           ST_XMin(ST_Extent(geom))                        AS west,
           ST_YMin(ST_Extent(geom))                        AS south,
           ST_XMax(ST_Extent(geom))                        AS east,
           ST_YMax(ST_Extent(geom))                        AS north,
           (array_agg(id ORDER BY frp DESC NULLS LAST))[1] AS fire_id
    FROM detections
    WHERE cluster IS NOT NULL
    GROUP BY cluster
    ORDER BY count(*) DESC
    LIMIT 1
"""


@dataclass
class Target:
    """Какво се анализира: обхват, кой пожар го е причинил и кога е горял."""

    bbox: tuple[float, float, float, float]
    fire_id: int | None
    first_seen: date | None
    last_seen: date | None
    detections: int | None = None

    @property
    def label(self) -> str:
        """Име за ключовете в MinIO. Обхватът не е плочка на Sentinel, затова не е T-код."""
        if self.fire_id is not None:
            return f"fire-{self.fire_id}"
        west, south, east, north = self.bbox
        return f"bbox-{west:.2f}_{south:.2f}_{east:.2f}_{north:.2f}"


# --- Copernicus -------------------------------------------------------------------


def _post_json(url: str, body: dict, token: str, timeout: int = 90) -> bytes:
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()
    except urllib.error.HTTPError as err:
        # Тялото на грешката на Sentinel Hub казва точно кое поле не му харесва; без него
        # остава само "HTTP 400" и се гадае.
        raise RuntimeError(f"{url} върна HTTP {err.code}: {err.read().decode('utf-8', 'replace')}") from err


def access_token() -> str:
    client_id = os.getenv("COPERNICUS_CLIENT_ID", "")
    client_secret = os.getenv("COPERNICUS_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise RuntimeError(
            "Липсват COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET — същите, които ползва "
            "и `ingestion`. Виж .env.example."
        )

    body = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode("utf-8")
    request = urllib.request.Request(
        TOKEN_URL, data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)["access_token"]
    except urllib.error.HTTPError as err:
        raise RuntimeError(f"Copernicus отказа token: HTTP {err.code}") from err


def pick_acquisition(
    token: str,
    bbox: tuple[float, float, float, float],
    window: tuple[date, date],
    max_cloud: float,
    anchor: date,
) -> tuple[date, float]:
    """Кой ден да се вземе от прозореца: най-близкият до пожара с приемлива облачност.

    Търси се в каталога, а не направо с Process API, по две причини. Първо, празен
    отговор от Process API не е грешка — връща черен кадър, който минава през целия
    pipeline и завършва с ред от нули в `burn_severity`. И второ, така датата в
    съобщението е истинската дата на снимката, а не краят на прозореца, в който е търсено.

    Близостта до пожара е водеща, а облачността е праг, не оптимум: сцена отпреди месец
    мери и растежа на растителността, не само щетата.
    """
    since, until = window
    payload = {
        "bbox": list(bbox),
        "datetime": f"{since.isoformat()}T00:00:00Z/{until.isoformat()}T23:59:59Z",
        "collections": [COLLECTION],
        "limit": 100,
    }
    features = json.loads(_post_json(CATALOG_URL, payload, token))["features"]
    if not features:
        raise LookupError(f"Каталогът няма нито една сцена за {since}..{until} над {bbox}")

    # Един ден може да дойде от няколко плочки. Композитът ползва всичките, значи за
    # деня важи най-лошата от тях, а не средната.
    worst_cloud_per_day: dict[date, float] = {}
    for feature in features:
        properties = feature["properties"]
        day = date.fromisoformat(properties["datetime"][:10])
        cloud = float(properties.get("eo:cloud_cover", 100.0))
        worst_cloud_per_day[day] = max(worst_cloud_per_day.get(day, 0.0), cloud)

    clear = {day: cloud for day, cloud in worst_cloud_per_day.items() if cloud <= max_cloud}
    if not clear:
        best_day, best_cloud = min(worst_cloud_per_day.items(), key=lambda item: item[1])
        raise LookupError(
            f"В {since}..{until} няма сцена под {max_cloud:.0f}% облачност — най-чистата е "
            f"{best_day} с {best_cloud:.0f}%. Разшири прозореца (--window) или прага (--max-cloud)."
        )

    chosen = min(clear, key=lambda day: abs((day - anchor).days))
    return chosen, clear[chosen]


def raster_size(bbox: tuple[float, float, float, float], metres: float) -> tuple[int, int, float]:
    """Размер в пиксели за дадена резолюция, снижена дотолкова, че да мине през таваните."""
    west, south, east, north = bbox
    mid_latitude = math.radians((south + north) / 2)
    width_metres = (east - west) * METERS_PER_DEGREE * math.cos(mid_latitude)
    height_metres = (north - south) * METERS_PER_DEGREE

    while True:
        width = max(1, round(width_metres / metres))
        height = max(1, round(height_metres / metres))
        if max(width, height) <= MAX_DIMENSION and width * height / 1e6 <= MAX_MEGAPIXELS:
            return width, height, metres
        metres *= 1.25


def fetch_scene(
    token: str,
    bbox: tuple[float, float, float, float],
    day: date,
    width: int,
    height: int,
) -> bytes:
    """Двуканален float32 GeoTIFF (B08, B12) за един ден над зададения обхват."""
    payload = {
        "input": {
            "bounds": {
                "bbox": list(bbox),
                "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
            },
            "data": [{
                "type": COLLECTION,
                "dataFilter": {"timeRange": {
                    "from": f"{day.isoformat()}T00:00:00Z",
                    "to": f"{day.isoformat()}T23:59:59Z",
                }},
            }],
        },
        "output": {
            "width": width,
            "height": height,
            "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}],
        },
        "evalscript": EVALSCRIPT,
    }
    return _post_json(PROCESS_URL, payload, token)


def data_coverage(tiff: bytes) -> float:
    """Дял на пикселите с данни. Празен кадър е тих отказ, не изключение."""
    with rasterio.MemoryFile(tiff) as memfile, memfile.open() as src:
        nir = src.read(1)
        swir = src.read(2)
    return float(np.count_nonzero(nir + swir)) / nir.size


# --- Пожарът ----------------------------------------------------------------------


def find_burn(since: date, until: date) -> Target:
    """Най-голямото петно детекции в периода — то е и най-вероятно да си личи от космоса."""
    with psycopg.connect(postgres_dsn()) as conn, conn.cursor() as cur:
        cur.execute(FIND_BURN_SQL, {
            "eps": CLUSTER_EPS_DEGREES,
            "since": since,
            "until": until + timedelta(days=1),
        })
        row = cur.fetchone()

    if row is None:
        raise LookupError(
            f"В {since}..{until} няма клъстер от поне 2 детекции. Разшири периода или задай "
            f"--bbox ръчно."
        )

    detections, first_seen, last_seen, west, south, east, north, fire_id = row
    bbox = (
        west - BBOX_BUFFER_DEGREES,
        south - BBOX_BUFFER_DEGREES,
        east + BBOX_BUFFER_DEGREES,
        north + BBOX_BUFFER_DEGREES,
    )
    return Target(bbox, fire_id, first_seen, last_seen, detections)


def scene_windows(
    target: Target,
    explicit_pre: date | None,
    explicit_post: date | None,
    window_days: int,
    smoke_days: int,
) -> tuple[tuple[date, date], tuple[date, date]]:
    """Прозорците, в които се търсят двете сцени.

    Зададена изрично дата се търси в тесен прозорец около нея, за да не се иска сцена в
    ден, в който сателитът не е минавал.
    """
    if explicit_pre and explicit_post:
        return (
            (explicit_pre - timedelta(days=window_days), explicit_pre),
            (explicit_post, explicit_post + timedelta(days=window_days)),
        )
    if target.first_seen is None or target.last_seen is None:
        raise ValueError("При ръчен --bbox трябват и --pre, и --post")

    # Ден преди първата детекция: пожарът вече е горял, когато е бил засечен.
    pre_end = target.first_seen - timedelta(days=1)
    # Димът поглъща SWIR не по-малко от NIR и разваля NBR, затова се чака да се разнесе.
    post_start = target.last_seen + timedelta(days=smoke_days)
    return (
        (pre_end - timedelta(days=window_days), pre_end),
        (post_start, post_start + timedelta(days=window_days)),
    )


# --- Публикуване ------------------------------------------------------------------


def publish(target: Target, pre_key: str, pre_day: date, post_key: str, post_day: date) -> None:
    message = {
        "message_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "dnbr-scene-fetcher",
        "payload": {
            "fire_id": target.fire_id,
            "bucket": SOURCE_BUCKET,
            "tile": target.label,
            "bbox": list(target.bbox),
            "crs": "EPSG:4326",
            "bands": BANDS,
            "pre": {"path": pre_key, "date": pre_day.isoformat()},
            "post": {"path": post_key, "date": post_day.isoformat()},
        },
    }

    connection = pika.BlockingConnection(rabbitmq_params())
    try:
        channel = connection.channel()
        channel.basic_publish(
            exchange=EXCHANGE,
            routing_key=ROUTING_KEY,
            body=json.dumps(message),
            properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
        )
    finally:
        connection.close()
    log.info("Публикувах задача → %s (fire_id=%s)", ROUTING_KEY, target.fire_id)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--since", type=date.fromisoformat, help="начало на периода за търсене на пожар")
    parser.add_argument("--until", type=date.fromisoformat, help="край на периода (включително)")
    parser.add_argument("--bbox", type=float, nargs=4, metavar=("W", "S", "E", "N"),
                        help="ръчен обхват вместо търсене в active_fires")
    parser.add_argument("--fire-id", type=int, help="към кой пожар да се върже анализът при ръчен --bbox")
    parser.add_argument("--pre", type=date.fromisoformat, help="желана дата на сцената преди")
    parser.add_argument("--post", type=date.fromisoformat, help="желана дата на сцената след")
    parser.add_argument("--window", type=int, default=12,
                        help="колко дни назад/напред се търси сцена (по подразбиране 12; "
                             "Sentinel-2 минава на ~5)")
    parser.add_argument("--smoke-days", type=int, default=3,
                        help="колко дни след последната детекция да се чака димът (по подразбиране 3)")
    parser.add_argument("--max-cloud", type=float, default=20.0, help="таван на облачността в %% (20)")
    parser.add_argument("--resolution", type=float, default=DEFAULT_METRES,
                        help="метри на пиксел (20 = оригиналът на B12)")
    parser.add_argument("--min-coverage", type=float, default=0.6,
                        help="минимален дял пиксели с данни, под който сцената се отхвърля (0.6)")
    parser.add_argument("--dry-run", action="store_true",
                        help="намира пожара и датите, но не сваля, не качва и не публикува")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.bbox:
        target = Target(tuple(args.bbox), args.fire_id, args.pre, args.post)
        log.info("Ръчен обхват %s", target.bbox)
    else:
        if not (args.since and args.until):
            raise SystemExit("Трябват --since и --until, или --bbox с --pre и --post")
        target = find_burn(args.since, args.until)
        log.info(
            "Пожар: %d детекции, %s..%s, обхват %.3f %.3f %.3f %.3f, водеща детекция #%s",
            target.detections, target.first_seen, target.last_seen, *target.bbox, target.fire_id,
        )

    pre_window, post_window = scene_windows(target, args.pre, args.post, args.window, args.smoke_days)
    width, height, metres = raster_size(target.bbox, args.resolution)
    if metres > args.resolution:
        log.warning("Обхватът е голям — резолюцията е снижена до %.0f м/пиксел", metres)
    log.info("Растер %d×%d (%.0f м/пиксел, %.1f MP)", width, height, metres, width * height / 1e6)

    token = access_token()

    anchor_pre = target.first_seen or pre_window[1]
    anchor_post = target.last_seen or post_window[0]
    pre_day, pre_cloud = pick_acquisition(token, target.bbox, pre_window, args.max_cloud, anchor_pre)
    post_day, post_cloud = pick_acquisition(token, target.bbox, post_window, args.max_cloud, anchor_post)
    log.info("Сцена преди: %s (%.0f%% облачност) | сцена след: %s (%.0f%%)",
             pre_day, pre_cloud, post_day, post_cloud)

    if args.dry_run:
        log.info("--dry-run: спирам преди сваляне, качване и публикуване")
        return

    pre_key = f"sentinel2/{pre_day.isoformat()}/{target.label}_pre.tif"
    post_key = f"sentinel2/{post_day.isoformat()}/{target.label}_post.tif"

    s3 = s3_client()
    # Една по една: ако сцената „преди" не става, няма смисъл да се харчи квота за „след".
    for day, key in ((pre_day, pre_key), (post_day, post_key)):
        tiff = fetch_scene(token, target.bbox, day, width, height)
        coverage = data_coverage(tiff)
        if coverage < args.min_coverage:
            raise SystemExit(
                f"Сцената за {day} покрива само {coverage:.0%} от кадъра (иска се поне "
                f"{args.min_coverage:.0%}). Не публикувам — двете сцени трябва да мерят едно и също."
            )
        s3.put_object(Bucket=SOURCE_BUCKET, Key=key, Body=tiff)
        log.info("Качих %s/%s — %.1f MB, %.0f%% с данни", SOURCE_BUCKET, key, len(tiff) / 1e6, coverage * 100)

    publish(target, pre_key, pre_day, post_key, post_day)


if __name__ == "__main__":
    main()
