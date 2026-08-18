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

> Реалният Sentinel-2 fetcher на бекенда вече качва GeoTIFF в MinIO и публикува
> `satellite.ingest` — mock publisher-ът остава само за ръчна проверка и за DLQ пътя.

## Тестове

```bash
pip install -r ../requirements-dev.txt
python -m pytest
```

Пише истински двуканален GeoTIFF във временна папка и го чете обратно — кой канал е кой е
половината от логиката тук. Покрива формулата, реда на каналите (обърнат ред = обърнат знак
на NDVI), празните пиксели и това, че продуктът излиза един канал `float32`.

## Ограничения

Сцена над **20 мегапиксела** се отхвърля (→ `satellite.dlq`) вместо да убие контейнера по
OOM. Разшири ли се bbox-ът на fetcher-а, вдигни заедно `NDVI_MAX_MEGAPIXELS` и `mem_limit`
на `worker-ndvi`.

## Покритие ⚠️

Bbox-ът на fetcher-а е едно квадратче (`25.0–25.5, 42.4–42.8`, ~40×45 км при Казанлък), т.е.
NDVI има за около 1% от страната. За всички останали зони `ndvi_mean` е NULL и NDVI корекцията
в риск модела не прави нищо. Отворено — иска или няколко сцени в мозайка, или по-широк източник.
