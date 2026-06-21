"""Еднократен loader на EFFIS fuel картата за България (Фаза 1).

Сваля EFFIS European Fuel Map (NFFL модели, Copernicus EMS), изрязва само
България (EPSG:4326) и качва в MinIO `processed-products/fuel/bg_fuel.tif`.
Risk zones job-ът после семплира оттам.

Източник: forest-fire.emergency.copernicus.eu/applications/data-and-services
Кодове: NFFL fire behavior модели (Anderson 1982), 0 = негоримо, 1-10 = горивни.

Употреба (Python 3.11, rasterio):
    python load_fuel.py
"""
import os
import ssl
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path

import boto3
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

URL = ("https://data.effis.emergency.copernicus.eu/effis/"
       "applications/data-and-services/FuelMap_LAEA.zip")
BG_BOUNDS = ["22.3", "41.2", "28.7", "44.2"]  # w s e n (EPSG:4326)
OUT_BUCKET = "processed-products"
OUT_KEY = "fuel/bg_fuel.tif"


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"),
        aws_access_key_id=os.getenv("MINIO_ROOT_USER", "wiser"),
        aws_secret_access_key=os.getenv("MINIO_ROOT_PASSWORD", ""),
        region_name="us-east-1",
    )


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        zip_path = tmp / "fuel.zip"

        print("Сваляне на EFFIS fuel карта (~17 MB)...")
        # EFFIS сървърът има изтекъл SSL сертификат → пропускаме проверката.
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=180) as r, open(zip_path, "wb") as f:
            f.write(r.read())

        with zipfile.ZipFile(zip_path) as z:
            z.extractall(tmp)
        src = next(tmp.glob("*NFFL*.tif"))

        out = tmp / "bg_fuel.tif"
        print("Изрязвам България (EPSG:4326, ~250m, nearest)...")
        subprocess.run(
            ["rio", "warp", str(src), str(out), "--dst-crs", "EPSG:4326",
             "--bounds", *BG_BOUNDS, "--res", "0.0025",
             "--resampling", "nearest", "--overwrite"],
            check=True,
        )

        print(f"Качвам в MinIO {OUT_BUCKET}/{OUT_KEY}...")
        s3_client().upload_file(str(out), OUT_BUCKET, OUT_KEY)
        print("Готово.")


if __name__ == "__main__":
    main()
