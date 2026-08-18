"""Конфигурация за dNBR worker-а — чете от .env в корена на репото."""
import os
from pathlib import Path

import boto3
import pika
from dotenv import load_dotenv

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


def postgres_dsn() -> str:
    return (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'wiser')} "
        f"user={os.getenv('POSTGRES_USER', 'wiser')} "
        f"password={os.getenv('POSTGRES_PASSWORD', '')}"
    )


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"),
        aws_access_key_id=os.getenv("MINIO_ROOT_USER", "wiser"),
        aws_secret_access_key=os.getenv("MINIO_ROOT_PASSWORD", ""),
        region_name="us-east-1",  # MinIO не я ползва, но boto3 я изисква
    )
