"""Конфигурация за връзките — чете от .env в корена на репото.

Локалните default-и сочат към docker-compose.dev.yml стека (localhost).
"""
import os
from pathlib import Path

import pika
from dotenv import load_dotenv

# data/processing/fwi/config.py -> parents[3] = коренът на репото
REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(REPO_ROOT / ".env")


def rabbitmq_params() -> pika.ConnectionParameters:
    creds = pika.PlainCredentials(
        os.getenv("RABBITMQ_USER", "wiser"),
        os.getenv("RABBITMQ_PASSWORD", ""),
    )
    return pika.ConnectionParameters(
        host=os.getenv("RABBITMQ_HOST", "localhost"),
        port=int(os.getenv("RABBITMQ_PORT", "5672")),
        virtual_host=os.getenv("RABBITMQ_VHOST", "wiser"),
        credentials=creds,
        heartbeat=600,
    )


def timescale_dsn() -> str:
    return (
        f"host={os.getenv('TIMESCALE_HOST', 'localhost')} "
        f"port={os.getenv('TIMESCALE_PORT', '5433')} "
        f"dbname={os.getenv('TIMESCALE_DB', 'wiser_timeseries')} "
        f"user={os.getenv('TIMESCALE_USER', 'wiser')} "
        f"password={os.getenv('POSTGRES_PASSWORD', '')}"
    )
