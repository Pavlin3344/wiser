"""Mock publisher — бутва примерно `weather.ingest` съобщение.

Замества още-неготовия EFFIS downloader на бекенда, за да можем да
тестваме FWI worker-а end-to-end локално.

Употреба:
    python mock_publisher.py          # валидно съобщение
    python mock_publisher.py --broken # счупено съобщение (тества DLQ)
"""
import argparse
import json
import uuid
from datetime import datetime, timezone

import pika

from config import rabbitmq_params

EXCHANGE = "weather.exchange"
ROUTING_KEY = "weather.ingest"


def valid_message() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "message_id": str(uuid.uuid4()),
        "timestamp": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "effis-downloader",
        "payload": {
            "date": now.strftime("%Y-%m-%d"),
            "resolution_km": 8,
            "points": [
                {"lat": 42.50, "lon": 25.00, "fwi": 18.4, "fwi_class": 4},
                {"lat": 42.60, "lon": 25.10, "fwi": 21.2, "fwi_class": 5},
                {"lat": 42.70, "lon": 23.30, "fwi": 9.1, "fwi_class": 2},
            ],
        },
    }


def broken_message() -> dict:
    # Липсва "points" → worker-ът ще гръмне и ще nack-не към DLQ
    return {
        "message_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "effis-downloader",
        "payload": {"date": "2026-06-20"},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--broken", action="store_true", help="прати счупено съобщение")
    args = parser.parse_args()

    msg = broken_message() if args.broken else valid_message()

    conn = pika.BlockingConnection(rabbitmq_params())
    channel = conn.channel()
    channel.basic_publish(
        exchange=EXCHANGE,
        routing_key=ROUTING_KEY,
        body=json.dumps(msg),
        properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
    )
    kind = "СЧУПЕНО" if args.broken else "валидно"
    points = len(msg["payload"].get("points", []))
    print(f"Публикувах {kind} съобщение ({points} точки) → {ROUTING_KEY}")
    conn.close()


if __name__ == "__main__":
    main()
