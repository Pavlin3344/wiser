"""dNBR worker — Фаза 3 (тежест на изгарянето след пожар).

Консумира `analysis.tasks`: двойка Sentinel-2 сцени за един и същ район — една отпреди
пожара и една отпосле, с канали B08 (NIR) и B12 (SWIR2). Смята dNBR, записва растера в
MinIO (`processed-products/dnbr/...`) и обобщението в PostGIS таблицата `burn_severity`.

Контракт: shared/schemas/message-contracts.md, раздел „Фаза 3".
Невалидно съобщение → `analysis.dlq`.
"""
import json
import logging
import os
import tempfile

import pika
import psycopg
import rasterio

from burn_severity import (
    CLASS_NAMES,
    classify,
    delta_nbr,
    mean_dnbr,
    normalized_burn_ratio,
    row_pixel_hectares,
    severity_stats,
)
from config import postgres_dsn, rabbitmq_params, s3_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("dnbr-worker")

QUEUE = "analysis.tasks"
OUTPUT_BUCKET = "processed-products"

NIR_BAND = "B08"
SWIR_BAND = "B12"

# Таван на размера на сцената. Сметката държи в паметта по няколко float32 масива на
# сцена (~24 байта на пиксел на пик), а контейнерът е с лимит 768 MB. Ако не се спре тук,
# голяма сцена го убива по OOM — а убитият контейнер не е потвърдил съобщението, то се
# връща в опашката и следва цикъл от рестарти, който запушва и всичко останало.
# По-добре ясна грешка към DLQ. Вдигаш ли лимита на контейнера, вдигни и това.
MAX_MEGAPIXELS = float(os.getenv("DNBR_MAX_MEGAPIXELS", "20"))

# Обновяване при повторен анализ на същата двойка сцени — виж V3__burn_severity.sql.
INSERT_SQL = """
    INSERT INTO burn_severity
        (fire_id, geom, pre_date, post_date, raster_path, mean_dnbr,
         burned_hectares, analysed_hectares,
         ha_regrowth, ha_unburned, ha_low, ha_moderate_low, ha_moderate_high, ha_high,
         computed_at)
    VALUES
        (%s, ST_MakeEnvelope(%s, %s, %s, %s, 4326), %s, %s, %s, %s,
         %s, %s, %s, %s, %s, %s, %s, %s, NOW())
    ON CONFLICT (fire_id, pre_date, post_date) DO UPDATE SET
        geom = EXCLUDED.geom,
        raster_path = EXCLUDED.raster_path,
        mean_dnbr = EXCLUDED.mean_dnbr,
        burned_hectares = EXCLUDED.burned_hectares,
        analysed_hectares = EXCLUDED.analysed_hectares,
        ha_regrowth = EXCLUDED.ha_regrowth,
        ha_unburned = EXCLUDED.ha_unburned,
        ha_low = EXCLUDED.ha_low,
        ha_moderate_low = EXCLUDED.ha_moderate_low,
        ha_moderate_high = EXCLUDED.ha_moderate_high,
        ha_high = EXCLUDED.ha_high,
        computed_at = NOW()
"""


def parse_task(body: bytes) -> dict:
    """Проверява съобщението по контракта и връща само нужното.

    Проверките са тук, а не пръснати из обработката: липсващо поле трябва да отиде в
    DLQ преди да сме свалили два растера от MinIO.
    """
    payload = json.loads(body)["payload"]

    for scene in ("pre", "post"):
        if scene not in payload:
            raise KeyError(f"липсва сцена '{scene}'")
        for field in ("path", "date"):
            if field not in payload[scene]:
                raise KeyError(f"сцена '{scene}' е без '{field}'")

    bands = payload["bands"]
    for band in (NIR_BAND, SWIR_BAND):
        if band not in bands:
            raise ValueError(f"dNBR иска канал {band}, а съобщението дава {bands}")

    bbox = payload["bbox"]
    if len(bbox) != 4:
        raise ValueError(f"bbox трябва да е [запад, юг, изток, север], а е {bbox}")

    return {
        "fire_id": payload.get("fire_id"),
        "bucket": payload["bucket"],
        "bands": bands,
        "bbox": bbox,
        "pre": payload["pre"],
        "post": payload["post"],
    }


def scene_nbr(path: str, bands: list[str]):
    """NBR на една сцена + профилът ѝ (rasterio брои каналите от 1)."""
    with rasterio.open(path) as src:
        megapixels = src.width * src.height / 1e6
        if megapixels > MAX_MEGAPIXELS:
            raise ValueError(
                f"Сцената е {megapixels:.1f} MP, а таванът е {MAX_MEGAPIXELS:.0f} MP "
                f"({src.width}×{src.height}) — не се събира в паметта на контейнера"
            )
        nir = src.read(bands.index(NIR_BAND) + 1)
        swir = src.read(bands.index(SWIR_BAND) + 1)
        profile = src.profile.copy()
    return normalized_burn_ratio(nir, swir), profile


def analyse(pre_path: str, post_path: str, bands: list[str]):
    """Двете сцени → (dNBR растер, профил за запис, обобщение)."""
    pre_nbr, _ = scene_nbr(pre_path, bands)
    post_nbr, profile = scene_nbr(post_path, bands)

    dnbr = delta_nbr(pre_nbr, post_nbr)
    classes = classify(dnbr)

    crs = profile.get("crs")
    if crs is None:
        # Контрактът казва EPSG:4326; без CRS в самия файл приемаме него, но го казваме
        # на глас, защото от това зависи как се смятат хектарите.
        log.warning("Сцената е без CRS — приемам EPSG:4326 за сметката на площите")
    geographic = crs.is_geographic if crs is not None else True

    hectares = row_pixel_hectares(profile["transform"], profile["height"], geographic)
    stats = severity_stats(classes, hectares)
    stats["mean_dnbr"] = mean_dnbr(dnbr)

    profile.update(count=1, dtype="float32", nodata=float("nan"), compress="deflate")
    return dnbr, profile, stats


def store_summary(db, task: dict, raster_path: str, stats: dict) -> None:
    per_class = stats["per_class"]
    west, south, east, north = task["bbox"]
    with db.cursor() as cur:
        cur.execute(INSERT_SQL, (
            task["fire_id"], west, south, east, north,
            task["pre"]["date"], task["post"]["date"], raster_path,
            stats["mean_dnbr"], stats["burned_hectares"], stats["analysed_hectares"],
            *[per_class[CLASS_NAMES[code]] for code in sorted(CLASS_NAMES)],
        ))
    db.commit()


def process_message(body: bytes, s3, db) -> dict:
    """Сваля двете сцени, смята dNBR, качва растера и записва обобщението."""
    task = parse_task(body)
    # Анализ без конкретна детекция е позволен (район, посочен на ръка) — в ключа влиза
    # ASCII дума, а не празно място, за да не се раждат странни пътища в MinIO.
    fire_folder = task["fire_id"] if task["fire_id"] is not None else "unassigned"

    with tempfile.NamedTemporaryFile(suffix=".tif") as pre_f, \
         tempfile.NamedTemporaryFile(suffix=".tif") as post_f, \
         tempfile.NamedTemporaryFile(suffix=".tif") as out_f:
        s3.download_file(task["bucket"], task["pre"]["path"], pre_f.name)
        s3.download_file(task["bucket"], task["post"]["path"], post_f.name)

        dnbr, profile, stats = analyse(pre_f.name, post_f.name, task["bands"])

        with rasterio.open(out_f.name, "w", **profile) as dst:
            dst.write(dnbr, 1)

        key = f"dnbr/{fire_folder}/{task['pre']['date']}_{task['post']['date']}.tif"
        s3.upload_file(out_f.name, OUTPUT_BUCKET, key)

    raster_path = f"{OUTPUT_BUCKET}/{key}"
    store_summary(db, task, raster_path, stats)

    return {"raster_path": raster_path, "fire_id": task["fire_id"], **stats}


def main() -> None:
    s3 = s3_client()
    db = psycopg.connect(postgres_dsn())
    conn = pika.BlockingConnection(rabbitmq_params())
    channel = conn.channel()
    channel.basic_qos(prefetch_count=1)

    def on_message(ch, method, _properties, body):
        try:
            result = process_message(body, s3, db)
            log.info(
                "dNBR готов → %s (изгоряло: %.1f ha от %.1f ha, средно dNBR %s)",
                result["raster_path"], result["burned_hectares"], result["analysed_hectares"],
                f"{result['mean_dnbr']:.3f}" if result["mean_dnbr"] is not None else "няма данни",
            )
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as exc:  # noqa: BLE001 — всичко → DLQ
            db.rollback()
            log.error("Невалидна задача → analysis.dlq: %s", exc)
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    channel.basic_consume(queue=QUEUE, on_message_callback=on_message)
    log.info("dNBR worker слуша опашка '%s' (Ctrl+C за спиране)...", QUEUE)
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        log.info("Спирам...")
        channel.stop_consuming()
    finally:
        conn.close()
        db.close()


if __name__ == "__main__":
    main()
