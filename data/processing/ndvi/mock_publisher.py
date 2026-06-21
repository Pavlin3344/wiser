"""Mock publisher за NDVI worker-а.

Замества още-неготовия Sentinel-2 fetcher на бекенда:
1. генерира малък синтетичен 2-канален GeoTIFF (B04 червен, B08 NIR) над България,
2. качва го в bucket `satellite-imagery`,
3. публикува `satellite.ingest` съобщение по контракта.

Употреба:
    python mock_publisher.py            # валиден сценарий
    python mock_publisher.py --broken   # липсващ файл → satellite.dlq
"""
import argparse
import json
import tempfile
import uuid
from datetime import datetime, timezone

import numpy as np
import pika
import rasterio
from rasterio.transform import from_bounds

from config import rabbitmq_params, s3_client

EXCHANGE = "satellite.exchange"
ROUTING_KEY = "satellite.ingest"
SOURCE_BUCKET = "satellite-imagery"

# Малка плочка над централна България
BBOX = [25.0, 42.4, 25.5, 42.8]  # west, south, east, north (EPSG:4326)
TILE = "T34TGN"
SIZE = 256


def make_synthetic_scene(path: str) -> None:
    """2-канален GeoTIFF: band1=B04 (червен), band2=B08 (NIR)."""
    rng = np.random.default_rng(42)
    # Реалистични отражения: растителност → нисък червен, висок NIR
    red = rng.uniform(0.02, 0.15, (SIZE, SIZE)).astype("float32")
    nir = rng.uniform(0.30, 0.60, (SIZE, SIZE)).astype("float32")
    transform = from_bounds(*BBOX, SIZE, SIZE)
    profile = {
        "driver": "GTiff",
        "height": SIZE,
        "width": SIZE,
        "count": 2,
        "dtype": "float32",
        "crs": "EPSG:4326",
        "transform": transform,
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(red, 1)
        dst.write(nir, 2)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--broken", action="store_true", help="посочи несъществуващ файл")
    args = parser.parse_args()

    s3 = s3_client()
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"sentinel2/{date}/{TILE}.tif"

    if not args.broken:
        with tempfile.NamedTemporaryFile(suffix=".tif") as f:
            make_synthetic_scene(f.name)
            s3.upload_file(f.name, SOURCE_BUCKET, key)
        print(f"Качих синтетична сцена → {SOURCE_BUCKET}/{key}")
    else:
        key = f"sentinel2/{date}/DOES_NOT_EXIST.tif"
        print("Режим --broken: сочи липсващ файл")

    msg = {
        "message_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "sentinel-fetcher",
        "payload": {
            "bucket": SOURCE_BUCKET,
            "path": key,
            "tile": TILE,
            "date": date,
            "bands": ["B04", "B08"],
            "bbox": BBOX,
            "crs": "EPSG:4326",
        },
    }

    conn = pika.BlockingConnection(rabbitmq_params())
    channel = conn.channel()
    channel.basic_publish(
        exchange=EXCHANGE,
        routing_key=ROUTING_KEY,
        body=json.dumps(msg),
        properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
    )
    print(f"Публикувах съобщение → {ROUTING_KEY}")
    conn.close()


if __name__ == "__main__":
    main()
