# Wiser — Message Contracts & Data Schemas (Phase 1)

> Единен reference за договореното между **Backend** и **Data Engineer** за Фаза 1 (Превенция).
> Никой не променя нещо тук без PR + review от другата страна.
>
> Статус: чернова за финално потвърждение на срещата. Виж [Отворени решения](#отворени-решения--потвърди-на-срещата).

---

## 1. Глобални конвенции (валидни за целия екип)

| Тема | Стойност |
|---|---|
| Координатна система | **EPSG:4326 (WGS84)** навсякъде |
| Времеви маркери | **UTC**, ISO-8601 (`2026-06-18T06:00:00Z`) |
| Геометрия на границата API↔DB | GeoJSON |
| Температура | °C |
| Скорост на вятъра | m/s |
| FWI | безразмерен индекс |
| Обхват (MVP) | **само България** |

**Message envelope** — всяко съобщение в RabbitMQ има общ плик:

```json
{
  "message_id": "uuid-v4",
  "timestamp": "2026-06-18T06:00:00Z",
  "source": "<service-name>",
  "payload": { }
}
```

---

## 2. FWI класове — легенда (1–6)

Числова скала, ползва се еднакво в `fire_weather_index`, `zones` и съобщенията.

| class | значение |
|:-:|---|
| 1 | low |
| 2 | medium |
| 3 | high |
| 4 | very_high |
| 5 | extreme |
| 6 | very_extreme |

---

## 3. Контракт: `weather.ingest`

- **Exchange → Queue:** `weather.exchange` → `weather.ingest` (DLQ: `weather.dlq`)
- **Produce:** Backend (`effis-downloader`)
- **Consume:** Data Engineer (FWI worker)
- **Източник:** EFFIS API — връща готов FWI по grid точки (виж ADR-0010). Data Engineer **не смята FWI**, само записва.
- **Батчинг:** едно съобщение на run с **масив от точки** (не отделни съобщения).

```json
{
  "message_id": "uuid-v4",
  "timestamp": "2026-06-18T06:00:00Z",
  "source": "effis-downloader",
  "payload": {
    "date": "2026-06-18",
    "resolution_km": 8,
    "points": [
      { "lat": 42.5, "lon": 25.0, "fwi": 18.4, "fwi_class": 4 },
      { "lat": 42.6, "lon": 25.1, "fwi": 21.2, "fwi_class": 5 }
    ]
  }
}
```

`fwi_class` е **число 1–6** (виж легендата).

---

## 4. Контракт: `satellite.ingest`

- **Exchange → Queue:** `satellite.exchange` → `satellite.ingest` (DLQ: `satellite.dlq`)
- **Produce:** Backend (`sentinel-fetcher`) — качва GeoTIFF в MinIO, публикува path
- **Consume:** Data Engineer (NDVI worker)
- **Канали:** за NDVI трябват **B04 (червен)** и **B08 (NIR)** — влизат в GeoTIFF-а.

```json
{
  "message_id": "uuid-v4",
  "timestamp": "2026-06-18T06:00:00Z",
  "source": "sentinel-fetcher",
  "payload": {
    "bucket": "satellite-imagery",
    "path": "sentinel2/2026-06-18/T34TGN.tif",
    "tile": "T34TGN",
    "date": "2026-06-18",
    "bands": ["B04", "B08"],
    "bbox": [23.5, 41.8, 26.0, 43.5],
    "crs": "EPSG:4326"
  }
}
```

NDVI продуктът се записва обратно в MinIO bucket `processed-products`.

---

## 5. DB: `fire_weather_index` (TimescaleDB)

Вече съществува в `db/timescale/hypertables/001_init.sql`. Маппинг от `weather.ingest`:

| колона | от съобщението |
|---|---|
| `time` | `payload.date` (като TIMESTAMPTZ, UTC) |
| `lat` | `points[].lat` |
| `lon` | `points[].lon` |
| `source` | `source` (`effis-downloader`) |
| `fwi` | `points[].fwi` |
| `class` | `points[].fwi_class` (SMALLINT 1–6) |

---

## 6. DB: `zones` (PostgreSQL + PostGIS)

- **Миграция пише:** Backend (`db/postgres/migrations/001_zones.sql`), в ден 1.
- **Пълни:** Data Engineer (Risk zones job).
- **Сервира:** Backend → `GET /zones/risk`.

```sql
CREATE TABLE zones (
    id          SERIAL PRIMARY KEY,
    geom        GEOMETRY(Polygon, 4326),
    fwi_class   SMALLINT,      -- 1-6
    fwi_value   FLOAT,
    ndvi_mean   FLOAT,
    fuel_type   INTEGER,       -- NFFL fuel модел (EFFIS), 0 = негоримо
    risk_class  SMALLINT,      -- 1-6, КРАЙНИЯТ клас за картата
    risk_score  FLOAT,         -- непрекъсната стойност (за сортиране/прозрачност)
    computed_at TIMESTAMPTZ,
    valid_date  DATE
);
CREATE INDEX ON zones USING GIST (geom);
```

> `risk_class` (1–6) е отделно от `fwi_class`, защото рискът е **комбинация**, не само FWI. Картата (6 класа от презентацията) рисува по `risk_class`.

---

## 7. Риск модел (MVP формула)

Прозрачна, правило-базирана. FWI е гръбнакът; NDVI и fuel го коригират.

```
risk_class = clamp( fwi_class + ndvi_корекция + fuel_корекция , 1, 6 )
```

**NDVI корекция** (суха растителност гори по-лесно):

| NDVI | корекция |
|---|:-:|
| 0.2 – 0.4 (сух стрес) | +1 |
| 0.4 – 0.6 (умерена) | 0 |
| > 0.6 (сочна, влажна) | −1 |

**Fuel корекция** (EFFIS NFFL fire behavior модели — виж `data/processing/fuel/README.md`):

| NFFL код | модел | корекция |
|---|---|:-:|
| 3, 4, 10 | висока трева, чапарал, timber + подлес | +1 |
| 1, 9 | къса трева, hardwood litter | −1 |
| 2, 5, 6, 7, 8 | умерени модели | 0 |
| 0 | негоримо (вода/град/гола почва) | **насила `risk_class = 1`** |

> **Правило за доверие:** негоримото (код 0 — град, вода, гола почва) никога не свети червено. Без това демото губи доверие.
> Тежести/коефициенти — за v2.

---

## 8. Отговорности (Фаза 1)

| Задача | Кой |
|---|---|
| ECMWF/EFFIS downloader → `weather.ingest` | Backend |
| Sentinel-2 fetcher → MinIO + `satellite.ingest` | Backend |
| OSM importer → `critical_infrastructure` + `roads` | Backend |
| `zones` миграция (DDL) | Backend |
| REST endpoints (`GET /zones/risk`) | Backend |
| FWI worker: `weather.ingest` → `fire_weather_index` | **Data Engineer** |
| NDVI worker: `satellite.ingest` → растер в MinIO | **Data Engineer** |
| Risk zones: FWI + NDVI + fuel → `zones` | **Data Engineer** |

---

## 9. Ритъм / scheduling

| Какво | Колко често |
|---|---|
| EFFIS FWI pull | дневно |
| Sentinel сцена | при нов overpass (~2–3 дни) |
| Risk zones преизчисление | **дневно** (с новия FWI; NDVI = последен наличен) |

---

## Отворени решения — потвърди на срещата

- [ ] **`fwi_class` = число** (1–6), не текст. → таблиците остават SMALLINT, без мапване. *(препоръка: да)*
- [ ] **Риск формулата** от раздел 7 — приета ли е като MVP? Кои фактори/тегла.
- [ ] **`risk_class` колона** добавена ли е в `zones` миграцията (отделно от `risk_score`)?
- [ ] **Дневен ритъм + само България** за MVP. *(препоръка: да)*

---

*Последна редакция: 2026-06-18*
