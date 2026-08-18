"""Mock publisher за dNBR worker-а.

Замества още-неготовия producer на бекенда (Фаза 3):
1. генерира две синтетични сцени (B08 NIR, B12 SWIR2) — една „преди" със здрава гора и
   една „след" с изгорял участък в средата,
2. качва ги в bucket `satellite-imagery`,
3. публикува `analysis.tasks` съобщение по контракта.

Изгореният участък е четвъртинка от кадъра, за да се види, че сметката за площ работи:
очакват се ~25% от анализираните хектари във високите класове.

Употреба:
    python mock_publisher.py            # валиден сценарий
    python mock_publisher.py --broken   # липсващ файл → analysis.dlq
"""
import argparse
import json
import tempfile
import uuid
from datetime import datetime, timedelta, timezone

import numpy as np
import pika
import rasterio
from rasterio.transform import from_bounds

from config import rabbitmq_params, s3_client

EXCHANGE = "analysis.exchange"
ROUTING_KEY = "analysis.tasks"
SOURCE_BUCKET = "satellite-imagery"

# Същата плочка, която ползва и NDVI mock-ът
BBOX = [25.0, 42.4, 25.5, 42.8]
TILE = "T34TGN"
SIZE = 256

HEALTHY_NIR, HEALTHY_SWIR = 4000.0, 1000.0   # NBR ≈ +0.6
BURNT_NIR, BURNT_SWIR = 1200.0, 2500.0       # NBR ≈ -0.35


def make_scene(path: str, burnt_quarter: bool) -> None:
    """2-канален GeoTIFF: band1 = B08 (NIR), band2 = B12 (SWIR2)."""
    nir = np.full((SIZE, SIZE), HEALTHY_NIR, dtype="float32")
    swir = np.full((SIZE, SIZE), HEALTHY_SWIR, dtype="float32")

    if burnt_quarter:
        half = SIZE // 2
        nir[:half, :half] = BURNT_NIR
        swir[:half, :half] = BURNT_SWIR

    profile = {
        "driver": "GTiff", "height": SIZE, "width": SIZE, "count": 2,
        "dtype": "float32", "crs": "EPSG:4326",
        "transform": from_bounds(*BBOX, SIZE, SIZE),
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(nir, 1)
        dst.write(swir, 2)


def upload(s3, key: str, burnt: bool) -> None:
    with tempfile.NamedTemporaryFile(suffix=".tif") as f:
        make_scene(f.name, burnt_quarter=burnt)
        s3.upload_file(f.name, SOURCE_BUCKET, key)
    print(f"Качих сцена → {SOURCE_BUCKET}/{key}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--broken", action="store_true", help="посочи липсваща сцена")
    parser.add_argument("--fire-id", type=int, default=None, help="id на пожар от active_fires")
    args = parser.parse_args()

    s3 = s3_client()
    today = datetime.now(timezone.utc).date()
    pre_date = (today - timedelta(days=20)).isoformat()
    post_date = today.isoformat()

    pre_key = f"sentinel2/{pre_date}/{TILE}_pre.tif"
    post_key = f"sentinel2/{post_date}/{TILE}_post.tif"

    if args.broken:
        post_key = f"sentinel2/{post_date}/DOES_NOT_EXIST.tif"
        print("Режим --broken: сцената 'след' липсва")
        upload(s3, pre_key, burnt=False)
    else:
        upload(s3, pre_key, burnt=False)
        upload(s3, post_key, burnt=True)

    msg = {
        "message_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "mock-publisher",
        "payload": {
            "fire_id": args.fire_id,
            "bucket": SOURCE_BUCKET,
            "tile": TILE,
            "bbox": BBOX,
            "crs": "EPSG:4326",
            "bands": ["B08", "B12"],
            "pre": {"path": pre_key, "date": pre_date},
            "post": {"path": post_key, "date": post_date},
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
    print(f"Публикувах задача → {ROUTING_KEY}")
    conn.close()


if __name__ == "__main__":
    main()
