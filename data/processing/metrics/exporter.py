"""Data pipeline metrics exporter — свежест на данните от Фаза 1.

Java сервизите ги вижда Prometheus през actuator; трите Python worker-а нямаха нищо.
Този процес запушва дупката, но не мери самите тях, а **резултата от тях**: кога за
последно са писали. Така „контейнерът работи, но нищо не влиза" (случвало се е — `zones`
стоя празна седмици, докато всичко изглеждаше зелено) не минава за здраво състояние.

Метриките са Unix timestamp-и, за да се питат в Prometheus като възраст:

    time() - wiser_data_zones_last_computed_timestamp_seconds > 86400

Липсваща стойност (празна таблица) НЕ се публикува като нула — иначе 1970-та изглежда
като „много старо, но съществуващо". Вместо това метриката просто липсва и се хваща с
`absent()`, което е отделен и по-точен сигнал.
"""
import logging
import os
import time

import psycopg
from prometheus_client import REGISTRY, start_http_server
from prometheus_client.core import GaugeMetricFamily

from config import postgres_dsn, s3_client, timescale_dsn
import log_shipper

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("data-metrics")

# Праща същите редове и към Logstash, ако LOGSTASH_HOST е зададен (Azure).
# На Compose е no-op: там filebeat чете stdout от docker json файловете.
log_shipper.install("data-metrics")

PORT = int(os.getenv("DATA_METRICS_PORT", "9105"))
PRODUCTS_BUCKET = "processed-products"
NDVI_PREFIX = "ndvi/"
FUEL_KEY = "fuel/bg_fuel.tif"


def probe_postgres():
    """Риск зоните и анализите на изгаряне (Фаза 3)."""
    with psycopg.connect(postgres_dsn()) as conn, conn.cursor() as cur:
        cur.execute("SELECT extract(epoch FROM max(computed_at)) FROM zones")
        (last_computed,) = cur.fetchone()
        cur.execute("SELECT count(*) FROM zones WHERE valid_date = current_date")
        (rows_today,) = cur.fetchone()

        readings = {
            "zones_last_computed": float(last_computed) if last_computed is not None else None,
            "zones_rows_today": float(rows_today),
        }

        # Таблицата идва с миграция V3. Проверката е нарочна: на среда, където
        # миграцията още не е минала, липсващата таблица би провалила цялата проба и
        # риск зоните биха изглеждали ненаблюдавани заради нещо съвсем друго.
        cur.execute("SELECT to_regclass('public.burn_severity')")
        if cur.fetchone()[0] is not None:
            cur.execute("SELECT extract(epoch FROM max(computed_at)), count(*) FROM burn_severity")
            last_analysis, analyses = cur.fetchone()
            readings["dnbr_last_analysis"] = float(last_analysis) if last_analysis is not None else None
            readings["dnbr_analyses_total"] = float(analyses)

    return readings


def probe_timescale():
    """FWI: кога е последното наблюдение и колко точки има за последния ден с данни.

    Броят точки е важен колкото и времето: смалила се решетка (EFFIS върнал половин
    покритие) не личи по свежест, а тихо оставя половин България без зони.
    """
    with psycopg.connect(timescale_dsn()) as conn, conn.cursor() as cur:
        cur.execute("SELECT extract(epoch FROM max(time)) FROM fire_weather_index")
        (last_observation,) = cur.fetchone()
        cur.execute(
            """
            SELECT count(*) FROM fire_weather_index
            WHERE time = (SELECT max(time) FROM fire_weather_index)
            """
        )
        (points_latest,) = cur.fetchone()
    return {
        "fwi_last_observation": float(last_observation) if last_observation is not None else None,
        "fwi_points_latest_day": float(points_latest),
    }


def probe_minio(s3):
    """NDVI продуктите и наличието на fuel картата.

    Fuel картата е статична, но ако я няма (нов MinIO volume, забравен bootstrap), риск
    моделът мълчаливо губи fuel корекцията и негоримото спира да се занулява.
    """
    # S3 връща най-много 1000 ключа наведнъж. Без обхождане на страниците броят замръзва
    # на 1000, а „най-новият растер" става най-новият от първата страница — тоест
    # алармата за давност би гръмнала при напълно жив pipeline.
    stamps = []
    token = None
    while True:
        params = {"Bucket": PRODUCTS_BUCKET, "Prefix": NDVI_PREFIX}
        if token:
            params["ContinuationToken"] = token
        resp = s3.list_objects_v2(**params)
        stamps += [
            o["LastModified"].timestamp()
            for o in resp.get("Contents", [])
            if o["Key"].endswith(".tif")
        ]
        if not resp.get("IsTruncated"):
            break
        token = resp["NextContinuationToken"]

    try:
        s3.head_object(Bucket=PRODUCTS_BUCKET, Key=FUEL_KEY)
        fuel_present = 1.0
    except Exception:  # noqa: BLE001 — липсващ обект и грешка се третират еднакво
        fuel_present = 0.0

    return {
        "ndvi_last_product": max(stamps) if stamps else None,
        "ndvi_product_count": float(len(stamps)),
        "fuel_map_present": fuel_present,
    }


# (име на метрика, ключ, описание). Отделно, защото рендерирането е тествано без база.
_TIMESTAMPS = [
    ("wiser_data_zones_last_computed_timestamp_seconds", "zones_last_computed",
     "Кога risk zones job-ът е писал в `zones` за последно"),
    ("wiser_data_fwi_last_observation_timestamp_seconds", "fwi_last_observation",
     "Най-новото наблюдение в `fire_weather_index`"),
    ("wiser_data_ndvi_last_product_timestamp_seconds", "ndvi_last_product",
     "Най-новият NDVI растер в MinIO"),
    # Без аларма за давност: анализът е събитиен (само след пожар), така че „отдавна
    # няма нов" значи „отдавна няма пожар" — това е добра новина, не повод за аларма.
    ("wiser_data_dnbr_last_analysis_timestamp_seconds", "dnbr_last_analysis",
     "Последният анализ на изгаряне (dNBR)"),
]

_GAUGES = [
    ("wiser_data_zones_rows_today", "zones_rows_today", "Брой риск зони за днешната дата"),
    ("wiser_data_fwi_points_latest_day", "fwi_points_latest_day",
     "Брой FWI точки за последния ден с данни"),
    ("wiser_data_ndvi_product_count", "ndvi_product_count", "Брой NDVI растери в MinIO"),
    ("wiser_data_fuel_map_present", "fuel_map_present",
     "1 ако fuel картата е в MinIO, иначе 0"),
    ("wiser_data_dnbr_analyses_total", "dnbr_analyses_total",
     "Брой анализи на изгаряне в `burn_severity`"),
]


def render(values, ok):
    """Стойности + статус на всеки източник → Prometheus метрики.

    Чиста функция: не пипа мрежа, за да е тестваема без стек.
    """
    success = GaugeMetricFamily(
        "wiser_data_scrape_success",
        "1 ако източникът е отговорил на този scrape, иначе 0",
        labels=["source"],
    )
    for source in sorted(ok):
        success.add_metric([source], ok[source])
    yield success

    for name, key, help_text in _TIMESTAMPS + _GAUGES:
        value = values.get(key)
        if value is None:
            continue  # няма данни → метриката липсва, вместо да лъже с нула
        yield GaugeMetricFamily(name, help_text, value=value)


class DataPipelineCollector:
    """Пита източниците при всеки scrape.

    Проби се подават отвън, за да може тестът да ги замени. Провалена проба не сваля
    целия exporter: останалите метрики излизат, а `wiser_data_scrape_success` за този
    източник става 0 — иначе една паднала база би изглеждала като „всичко е наред".
    """

    def __init__(self, probes):
        self.probes = probes

    def collect(self):
        values, ok = {}, {}
        for source, probe in self.probes.items():
            try:
                values.update(probe())
                ok[source] = 1.0
            except Exception:  # noqa: BLE001 — scrape-ът никога не бива да гърми
                log.exception("Източник '%s' не отговори на този scrape", source)
                ok[source] = 0.0
        yield from render(values, ok)


def main() -> None:
    s3 = s3_client()
    REGISTRY.register(DataPipelineCollector({
        "postgres": probe_postgres,
        "timescale": probe_timescale,
        "minio": lambda: probe_minio(s3),
    }))
    start_http_server(PORT)
    log.info("Data metrics exporter слуша на :%d/metrics", PORT)
    while True:
        time.sleep(3600)
        # Един ред на час. Досега процесът логваше точно веднъж при старт и мълчеше
        # завинаги - а изпращачът към Logstash изхвърля реда, ако точно в този момент
        # връзката не се вдигне, така че една несполучлива секунда означаваше нула логове
        # до следващия деплой. Освен това дава и признак на живот: за разлика от другите
        # workers тук няма съобщения, по които да се съди, че процесът още е жив.
        log.info("Data metrics exporter жив, обслужва :%d/metrics", PORT)


if __name__ == "__main__":
    main()
