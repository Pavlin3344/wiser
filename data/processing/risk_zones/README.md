# Risk zones job (Фаза 1)

Събира **FWI** (TimescaleDB) + **NDVI** (MinIO) + **fuel карта** (MinIO) и записва риск зони
като полигони в PostGIS таблицата `zones`. После бекендът ги сервира през `GET /zones/risk`.

Върти се като контейнер `risk-zones` в `docker-compose.yml` и се преизчислява на всеки 6 часа
(`RISK_ZONES_INTERVAL_SECONDS`). Дневният ритъм е вграден в самия процес, защото cron на хоста
не е част от репото — навремето точно затова таблицата стоеше празна. `RISK_ZONES_INTERVAL_SECONDS=0`
пуска еднократно (за ръчен run или backfill).

Риск моделът и схемата: [`shared/schemas/message-contracts.md`](../../../shared/schemas/message-contracts.md) (раздели 6–7).

## Setup (Python 3.11 — заради rasterio)

```bash
cd data/processing/risk_zones
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Таблицата `zones` идва от официалната миграция на бекенда
(`db/postgres/migrations/V2__zones.sql`) — Flyway я пуска сам. `dev_schema.sql` остава само за
работа без пълния стек.

## Пускане

```bash
python job.py
```

Изисква в базите вече да има FWI точки (FWI worker) и NDVI растер (NDVI worker), плюс
fuel картата в MinIO (`data/processing/fuel/load_fuel.py`, еднократно).

Проверка:
```bash
docker exec wiser-postgres psql -U wiser -d wiser \
  -c "SELECT id, fwi_class, ndvi_mean, risk_class, valid_date FROM zones ORDER BY risk_class DESC;"
```

## Тестове

```bash
pip install -r ../requirements-dev.txt
python -m pytest
```

Две групи, и двете без база:
- `test_risk_model.py` — границите на NDVI корекцията, NFFL кодовете и правилото, че
  негоримото (код 0) никога не свети червено.
- `test_job.py` — геометрията: стъпката на решетката (празнини между клетките), ъглите на
  клетката и рязането по границата на България. Точно тези три вече са били счупени наживо
  и се виждат само на картата, не в логовете.

## Бележки
- `fuel_type` е реален **NFFL** код от EFFIS картата (`processed-products/fuel/bg_fuel.tif`),
  не placeholder и не FirEUrisk. Легендата е в `../fuel/README.md`.
- `ndvi_mean` е NULL за почти цялата страна — Sentinel fetcher-ът покрива едно квадратче
  (~40×45 км). Докато не се разшири, NDVI корекцията в модела реално не участва.
- Очертанието в `bulgaria_border.json` е опростено (879 точки), брегът минава 1–2 км навътре
  от реалния. При клетки от ~8 км не мести нищо съществено.
- Същото очертание стои и във `frontend/src/data/bulgaria-border.json` — картата реже
  детекциите по него. Двата файла трябва да са еднакви, иначе зоните и детекциите спират да
  съвпадат по границата; CI ги сравнява (`validate-shared-data`). Смениш ли единия, смени и другия.
