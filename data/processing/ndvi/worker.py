"""NDVI worker — Фаза 1.

Консумира `satellite.ingest` (path към Sentinel-2 GeoTIFF в MinIO + канали B04/B08,
виж shared/schemas/message-contracts.md), смята NDVI = (NIR - Red)/(NIR + Red) и
записва резултата като GeoTIFF в bucket `processed-products`.

Невалидно съобщение → `satellite.dlq`.
"""
import json
import logging
import os
import tempfile

import numpy as np
import pika
import rasterio

from config import rabbitmq_params, s3_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("ndvi-worker")

QUEUE = "satellite.ingest"
OUTPUT_BUCKET = "processed-products"

# Таван на сцената. Двата канала се държат в паметта като float32 (~16 байта на пиксел с
# междинните масиви), а контейнерът е с лимит 768 MB. Без този предпазител прекалено
# голяма сцена убива контейнера по OOM, съобщението остава непотвърдено, връща се и
# следва цикъл от рестарти. По-добре ясна грешка към satellite.dlq.
# Ако bbox-ът на fetcher-а се разшири, вдигни и лимита на контейнера, и това число.
MAX_MEGAPIXELS = float(os.getenv("NDVI_MAX_MEGAPIXELS", "20"))


def compute_ndvi(local_tif: str, bands: list[str]) -> tuple[np.ndarray, dict]:
    """Чете B04 (червен) и B08 (NIR) и връща NDVI масив + rasterio profile."""
    red_idx = bands.index("B04") + 1  # rasterio брои каналите от 1
    nir_idx = bands.index("B08") + 1
    with rasterio.open(local_tif) as src:
        megapixels = src.width * src.height / 1e6
        if megapixels > MAX_MEGAPIXELS:
            raise ValueError(
                f"Сцената е {megapixels:.1f} MP, а таванът е {MAX_MEGAPIXELS:.0f} MP "
                f"({src.width}×{src.height}) — не се събира в паметта на контейнера"
            )
        red = src.read(red_idx).astype("float32")
        nir = src.read(nir_idx).astype("float32")
        profile = src.profile.copy()

    # `where` пропуска самото деление за празните пиксели (0 и в двата канала) и оставя
    # нулата от `out`. np.where смяташе 0/0 за целия масив и чак после го изхвърляше —
    # резултатът беше същият, но всяка сцена с no-data сипеше RuntimeWarning в логовете.
    denom = nir + red
    ndvi = np.divide(
        nir - red, denom,
        out=np.zeros_like(denom, dtype="float32"),
        where=denom != 0,
    ).astype("float32")

    profile.update(count=1, dtype="float32", compress="deflate")
    return ndvi, profile


def process_message(body: bytes, s3) -> str:
    """Сваля GeoTIFF от MinIO, смята NDVI, качва продукта. Връща изходния path."""
    msg = json.loads(body)
    payload = msg["payload"]
    bucket = payload["bucket"]
    path = payload["path"]
    bands = payload["bands"]
    tile = payload["tile"]
    date = payload["date"]

    with tempfile.NamedTemporaryFile(suffix=".tif") as src_f, \
         tempfile.NamedTemporaryFile(suffix=".tif") as out_f:
        s3.download_file(bucket, path, src_f.name)
        ndvi, profile = compute_ndvi(src_f.name, bands)
        with rasterio.open(out_f.name, "w", **profile) as dst:
            dst.write(ndvi, 1)

        out_key = f"ndvi/{date}/{tile}_ndvi.tif"
        s3.upload_file(out_f.name, OUTPUT_BUCKET, out_key)

    return f"{OUTPUT_BUCKET}/{out_key}"


def main() -> None:
    s3 = s3_client()
    conn = pika.BlockingConnection(rabbitmq_params())
    channel = conn.channel()
    channel.basic_qos(prefetch_count=1)

    def on_message(ch, method, _properties, body):
        try:
            out = process_message(body, s3)
            log.info("NDVI продукт записан → %s", out)
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as exc:  # noqa: BLE001 — всичко → DLQ
            log.error("Невалидно съобщение → satellite.dlq: %s", exc)
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    channel.basic_consume(queue=QUEUE, on_message_callback=on_message)
    log.info("NDVI worker слуша опашка '%s' (Ctrl+C за спиране)...", QUEUE)
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        log.info("Спирам...")
        channel.stop_consuming()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
