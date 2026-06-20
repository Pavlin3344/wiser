# Risk zones job (Фаза 1)

Batch job (дневен ритъм). Събира **FWI** (TimescaleDB) + **NDVI** (MinIO) + **fuel** (placeholder)
и записва риск зони като полигони в PostGIS таблицата `zones`. После бекендът ги сервира
през `GET /zones/risk`.

Риск моделът и схемата: [`shared/schemas/message-contracts.md`](../../../shared/schemas/message-contracts.md) (раздели 6–7).

## Setup (Python 3.11 — заради rasterio)

```bash
cd data/processing/risk_zones
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Таблицата `zones` още я няма официално (бекендът пише миграцията). За локална работа:
```bash
docker exec -i wiser-postgres psql -U wiser -d wiser < dev_schema.sql
```

## Пускане

```bash
python job.py
```

Изисква в базите вече да има FWI точки (FWI worker) и NDVI растер (NDVI worker).

Проверка:
```bash
docker exec wiser-postgres psql -U wiser -d wiser \
  -c "SELECT id, fwi_class, ndvi_mean, risk_class, valid_date FROM zones ORDER BY risk_class DESC;"
```

## Бележки
- `fuel_type` е **placeholder** (1212 = иглолистна). Като се зареди реалната FirEUrisk
  карта, се сменя само семплирането на fuel в `job.py` — формулата остава.
- `dev_schema.sql` е локален. Официалната `zones` миграция е на бекенда.
