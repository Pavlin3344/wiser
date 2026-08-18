# Wiser — Message Contracts & Data Schemas (Phase 1)

> Единен reference за договореното между **Backend** и **Data Engineer** за Фаза 1 (Превенция).
> Никой не променя нещо тук без PR + review от другата страна.
>
> Статус: **в сила и реализиран от двете страни.** Виж [Решенията](#решения) най-долу.

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

**Идемпотентност:** уникален индекс по `(time, lat, lon, source)`
(`db/timescale/hypertables/V3__fwi_dedup.sql`) + `ON CONFLICT DO NOTHING` в worker-а. Нужно е,
защото `@Scheduled` в downloader-а гърми при всеки старт на контейнера и препубликува цялата
решетка за деня — преди индекса всеки деплой добавяше още едно пълно копие и всяка клетка се
рисуваше двойно. Повторно публикуване вече е безобидно от двете страни.

---

## 6. DB: `zones` (PostgreSQL + PostGIS)

- **Миграция пише:** Backend — `db/postgres/migrations/V2__zones.sql` (готова, Flyway я пуска).
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

## 10. Контракт: `analysis.tasks` (Фаза 3) — ⚠️ предложение, чака ревю от Backend

> Реализирано е само от страната на Data Engineer (dNBR worker-ът консумира точно това).
> Producer няма — днес задачите се пускат на ръка с mock-а. Ако формата не ти отърва,
> кажи преди да пишеш producer-а: по-лесно се сменя сега.

- **Exchange → Queue:** `analysis.exchange` → `analysis.tasks` (DLQ: `analysis.dlq`)
- **Produce:** Backend (двойка Sentinel-2 сцени за угаснал пожар)
- **Consume:** Data Engineer (dNBR worker)
- **Канали:** за dNBR трябват **B08 (NIR)** и **B12 (SWIR2)** — в двете сцени, в един и същ ред.
- Двете сцени трябва да са с **еднакъв размер и обхват** (иначе задачата отива в DLQ).

```json
{
  "message_id": "uuid-v4",
  "timestamp": "2026-07-21T06:00:00Z",
  "source": "sentinel-fetcher",
  "payload": {
    "fire_id": 42,
    "bucket": "satellite-imagery",
    "tile": "T34TGN",
    "bbox": [25.0, 42.4, 25.5, 42.8],
    "crs": "EPSG:4326",
    "bands": ["B08", "B12"],
    "pre":  { "path": "sentinel2/2026-07-01/T34TGN_pre.tif",  "date": "2026-07-01" },
    "post": { "path": "sentinel2/2026-07-20/T34TGN_post.tif", "date": "2026-07-20" }
  }
}
```

`fire_id` е по избор (`null` = анализ на район, непривързан към конкретна детекция).

**Изход:** растер в MinIO `processed-products/dnbr/<fire_id>/<pre>_<post>.tif` + един ред в
`burn_severity` (миграция `V3__burn_severity.sql`). Класовете 1–6 и праговете са в
[`data/processing/dnbr/README.md`](../../data/processing/dnbr/README.md).

**Остава да се реши:** кой и кога пуска задачата — предложение: бекендът, когато пожар не е
бил засечен N дни (тоест е угаснал), с най-близките налични сцени преди и след.

---

## Решения

Четирите отворени точки са затворени — потвърдени от това, което и двете страни вече пуснаха:

- [x] **`fwi_class` = число** (1–6), не текст. Downloader-ът праща число, таблиците са SMALLINT, без мапване.
- [x] **Риск формулата** от раздел 7 е приета като MVP. Реализация: `data/processing/risk_zones/risk_model.py`, границите са заковани с тестове (`test_risk_model.py`). Тегла/коефициенти — v2.
- [x] **`risk_class` колона** — има я в `V2__zones.sql`, отделно от `risk_score`. Картата рисува по нея.
- [x] **Дневен ритъм + само България.** Зоните се преизчисляват на всеки 6 часа (EFFIS не публикува в предвидим час), а решетката се реже по `bulgaria_border.json`.

### Остава отворено

- **NDVI покрива ~1% от страната** — bbox-ът на Sentinel fetcher-а е едно квадратче, затова
  `ndvi_mean` е NULL за почти всяка зона и NDVI корекцията реално не участва в модела.
  Иска решение: мозайка от няколко сцени или по-широк източник.
- **Тегла в риск формулата** — засега всички корекции са ±1. За v2.

---

*Последна редакция: 2026-08-18 (статус актуализиран спрямо реализираното; промени по самите
контракти — само с PR + review от другата страна)*
