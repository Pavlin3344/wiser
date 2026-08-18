"""Конфигурация за data metrics exporter-а — чете от .env в корена на репото.

Същият шаблон като при другите workers, с една разлика: навсякъде има таймаути.
Exporter-ът се скрейпва на всеки 15 секунди, така че забита връзка към база или MinIO
не бива да виси — по-добре бърза грешка и `scrape_success 0`, отколкото натрупани
заспали заявки.
"""
import os
from pathlib import Path

import boto3
from botocore.config import Config as BotoConfig
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(REPO_ROOT / ".env")

CONNECT_TIMEOUT_SECONDS = 5


def postgres_dsn() -> str:
    return (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'wiser')} "
        f"user={os.getenv('POSTGRES_USER', 'wiser')} "
        f"password={os.getenv('POSTGRES_PASSWORD', '')} "
        f"connect_timeout={CONNECT_TIMEOUT_SECONDS}"
    )


def timescale_dsn() -> str:
    return (
        f"host={os.getenv('TIMESCALE_HOST', 'localhost')} "
        f"port={os.getenv('TIMESCALE_PORT', '5433')} "
        f"dbname={os.getenv('TIMESCALE_DB', 'wiser_timeseries')} "
        f"user={os.getenv('TIMESCALE_USER', 'wiser')} "
        f"password={os.getenv('POSTGRES_PASSWORD', '')} "
        f"connect_timeout={CONNECT_TIMEOUT_SECONDS}"
    )


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"),
        aws_access_key_id=os.getenv("MINIO_ROOT_USER", "wiser"),
        aws_secret_access_key=os.getenv("MINIO_ROOT_PASSWORD", ""),
        region_name="us-east-1",
        # Без retries: следващият scrape след 15 s е по-добър "retry" от чакане тук.
        config=BotoConfig(
            connect_timeout=CONNECT_TIMEOUT_SECONDS,
            read_timeout=CONNECT_TIMEOUT_SECONDS,
            retries={"max_attempts": 0},
        ),
    )
