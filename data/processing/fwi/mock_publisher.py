"""Mock publisher — бутва примерно `weather.ingest` съобщение.

Замества още-неготовия EFFIS downloader на бекенда, за да можем да
тестваме FWI worker-а end-to-end локално.

Употреба:
    python mock_publisher.py           # claim check, както праща downloader-ът
    python mock_publisher.py --inline  # старата форма с точки в съобщението
    python mock_publisher.py --broken  # счупено съобщение (тества DLQ)
"""
import argparse
import json
import uuid
from datetime import datetime, timezone

import pika

from config import rabbitmq_params, s3_client

EXCHANGE = "weather.exchange"
ROUTING_KEY = "weather.ingest"
BUCKET = "processed-products"


def claim_check_message() -> dict:
    """Качва решетката в MinIO и връща съобщение, което сочи към нея."""
    now = datetime.now(timezone.utc)
    date = now.strftime("%Y-%m-%d")
    key = f"fwi/{date}/points.json"

    document = {"date": date, "resolution_km": 8, "points": SAMPLE_POINTS}
    s3_client().put_object(
        Bucket=BUCKET, Key=key,
        Body=json.dumps(document).encode(), ContentType="application/json",
    )

    return {
        "message_id": str(uuid.uuid4()),
        "timestamp": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "effis-downloader",
        "payload": {
            "bucket": BUCKET, "path": key, "date": date,
            "resolution_km": 8, "point_count": len(SAMPLE_POINTS),
        },
    }


def valid_message() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "message_id": str(uuid.uuid4()),
        "timestamp": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "effis-downloader",
        "payload": {
            "date": now.strftime("%Y-%m-%d"),
            "resolution_km": 8,
            "points": SAMPLE_POINTS,
        },
    }


SAMPLE_POINTS = [
    {"lat": 42.50, "lon": 25.00, "fwi": 18.4, "fwi_class": 4},
    {"lat": 42.60, "lon": 25.10, "fwi": 21.2, "fwi_class": 5},
    {"lat": 42.70, "lon": 23.30, "fwi": 9.1, "fwi_class": 2},
]


def broken_message() -> dict:
    # Нито "points", нито bucket/path → worker-ът ще гръмне и ще nack-не към DLQ
    return {
        "message_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "effis-downloader",
        "payload": {"date": "2026-06-20"},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--broken", action="store_true", help="прати счупено съобщение")
    parser.add_argument("--inline", action="store_true", help="старата форма с точки в съобщението")
    args = parser.parse_args()

    if args.broken:
        msg = broken_message()
    elif args.inline:
        msg = valid_message()
    else:
        msg = claim_check_message()

    conn = pika.BlockingConnection(rabbitmq_params())
    channel = conn.channel()
    channel.basic_publish(
        exchange=EXCHANGE,
        routing_key=ROUTING_KEY,
        body=json.dumps(msg),
        properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
    )
    payload = msg["payload"]
    if args.broken:
        what = "СЧУПЕНО съобщение"
    elif "points" in payload:
        what = f"inline съобщение ({len(payload['points'])} точки)"
    else:
        what = f"claim check → {payload['bucket']}/{payload['path']} ({payload['point_count']} точки)"
    print(f"Публикувах {what} → {ROUTING_KEY}")
    conn.close()


if __name__ == "__main__":
    main()
