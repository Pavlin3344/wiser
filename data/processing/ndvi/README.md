# NDVI worker (Фаза 1)

Консумира `satellite.ingest` → смята NDVI от Sentinel-2 GeoTIFF (B04, B08) →
записва растер в MinIO bucket `processed-products` (`ndvi/<date>/<tile>_ndvi.tif`).
Контракт: [`shared/schemas/message-contracts.md`](../../../shared/schemas/message-contracts.md).

## Setup (еднократно) — Python 3.11

> rasterio/GDAL са сигурни на 3.11; затова не ползваме системния python3 (3.14).

```bash
cd data/processing/ndvi
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Изисква локалния стек (`docker-compose.dev.yml`). Връзките се четат от `.env` в корена.

## Пускане

```bash
# терминал 1 — worker-ът слуша
python worker.py

# терминал 2 — генерирай + качи синтетична сцена и публикувай
python mock_publisher.py            # валиден сценарий → NDVI продукт в MinIO
python mock_publisher.py --broken   # липсващ файл → satellite.dlq
```

Проверка на продукта:
```bash
docker exec wiser-minio sh -c 'mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc ls -r local/processed-products'
```

> Mock publisher-ът замества Sentinel-2 fetcher-а на бекенда. Като той стане готов
> (качва истински GeoTIFF + публикува `satellite.ingest`), worker-ът не се променя.
