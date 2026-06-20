"""FWI worker — Фаза 1.

Консумира `weather.ingest` (готов FWI от EFFIS, виж shared/schemas/message-contracts.md)
и записва точките в TimescaleDB таблицата `fire_weather_index`.

Невалидно съобщение се nack-ва без requeue → отива в `weather.dlq`.
"""
import json
import logging

import pika
import psycopg

from config import rabbitmq_params, timescale_dsn

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("fwi-worker")

QUEUE = "weather.ingest"

INSERT_SQL = """
    INSERT INTO fire_weather_index (time, lat, lon, source, fwi, class)
    VALUES (%s, %s, %s, %s, %s, %s)
"""


def process_message(body: bytes, db) -> int:
    """Парсва съобщението и записва точките. Връща броя записани редове."""
    msg = json.loads(body)
    source = msg.get("source", "unknown")
    payload = msg["payload"]
    date = payload["date"]
    points = payload["points"]

    rows = [
        (date, p["lat"], p["lon"], source, p["fwi"], p["fwi_class"])
        for p in points
    ]
    with db.cursor() as cur:
        cur.executemany(INSERT_SQL, rows)
    db.commit()
    return len(rows)


def main() -> None:
    db = psycopg.connect(timescale_dsn())
    conn = pika.BlockingConnection(rabbitmq_params())
    channel = conn.channel()
    channel.basic_qos(prefetch_count=1)

    def on_message(ch, method, _properties, body):
        try:
            n = process_message(body, db)
            log.info("Записах %d FWI точки в fire_weather_index", n)
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as exc:  # noqa: BLE001 — искаме да хванем всичко → DLQ
            db.rollback()
            log.error("Невалидно съобщение → weather.dlq: %s", exc)
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    channel.basic_consume(queue=QUEUE, on_message_callback=on_message)
    log.info("FWI worker слуша опашка '%s' (Ctrl+C за спиране)...", QUEUE)
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
