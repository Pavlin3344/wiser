"""Конфигурация за risk zones job-а — чете от .env в корена на репото."""
import os
from pathlib import Path

import boto3
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(REPO_ROOT / ".env")


def postgres_dsn() -> str:
    return (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'wiser')} "
        f"user={os.getenv('POSTGRES_USER', 'wiser')} "
        f"password={os.getenv('POSTGRES_PASSWORD', '')}"
    )


def timescale_dsn() -> str:
    return (
        f"host={os.getenv('TIMESCALE_HOST', 'localhost')} "
        f"port={os.getenv('TIMESCALE_PORT', '5433')} "
        f"dbname={os.getenv('TIMESCALE_DB', 'wiser_timeseries')} "
        f"user={os.getenv('TIMESCALE_USER', 'wiser')} "
        f"password={os.getenv('POSTGRES_PASSWORD', '')}"
    )


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"),
        aws_access_key_id=os.getenv("MINIO_ROOT_USER", "wiser"),
        aws_secret_access_key=os.getenv("MINIO_ROOT_PASSWORD", ""),
        region_name="us-east-1",
    )
