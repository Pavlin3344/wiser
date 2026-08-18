# Wiser — Connection Guide за разработчици

Този документ описва как backend и data processing workers се свързват към инфраструктурните сервизи на Wiser.

## Достъп до сървъра

Всички сервизи са достъпни само през **Tailscale VPN**.

- **Сървър IP**: `100.116.156.92`
- Без Tailscale няма достъп до нищо

Setup на Tailscale: виж `docs/team/onboarding.md`.

---

## Фаза 1 — статус на интеграцията (Data Engineer ↔ Backend)

> Кратко: **Фаза 1 е затворена от двете страни и тече наживо.** Реалните producer-и на
> бекенда публикуват, worker-ите ги консумират, зоните се рисуват на картата.
> Пълният договор: [`shared/schemas/message-contracts.md`](../../shared/schemas/message-contracts.md).
> Последна редакция: 2026-08-18.

### ✅ Какво работи (цялата верига)

| Компонент | Кой | Чете | Пише |
|---|---|---|---|
| EFFIS downloader | Backend | EFFIS WMS | `weather.ingest` |
| Sentinel-2 fetcher | Backend | Copernicus CDSE | MinIO `satellite-imagery` + `satellite.ingest` |
| OSM importer | Backend | Overpass / Geofabrik | `critical_infrastructure`, `roads` |
| `zones` миграция + `GET /zones/risk` | Backend | — | `db/postgres/migrations/V2__zones.sql` |
| FWI worker | Data Eng | `weather.ingest` | TimescaleDB `fire_weather_index` |
| NDVI worker | Data Eng | `satellite.ingest` | MinIO `processed-products/ndvi/` |
| Fuel карта (EFFIS NFFL, само BG) | Data Eng | EFFIS (еднократно) | MinIO `processed-products/fuel/bg_fuel.tif` |
| Risk zones job | Data Eng | FWI + NDVI + fuel | PostGIS `zones` |
| Data metrics exporter | Data Eng | двете бази + MinIO | Prometheus (`:9105/metrics`) |
| dNBR worker (Фаза 3) | Data Eng | `analysis.tasks` | MinIO `processed-products/dnbr/` + PostGIS `burn_severity` |

Всичко от колоната „Data Eng" са контейнери в `infra/docker/docker-compose.yml`
(`worker-fwi`, `worker-ndvi`, `risk-zones`, `worker-dnbr`, `data-metrics`). Mock publisher-ите
остават в репото само за ръчна проверка и за DLQ пътя — в нормална работа не се пускат.
Изключение е dNBR: за него още няма истински producer, така че mock-ът е единственият начин
да се пусне задача.

**Наблюдение:** `data-metrics` мери свежестта на данните (кога зоните/FWI/NDVI са се обновявали
за последно), а не дали контейнерите са живи — вдигнат контейнер, който нищо не произвежда, е
точно случаят, който вече ни се е случвал. Алармите са в
`infra/docker/prometheus/rules/data-processing.yml` и покриват също DLQ-тата и натрупване във
входните опашки. Подробно: [`data/processing/metrics/README.md`](../../data/processing/metrics/README.md).

### 🔲 За Backend (Ицо) — две неща чакат теб

**1. NDVI покрива ~1% от страната.** `SentinelFetcherService` дърпа едно квадратче
(`BBOX = {25.0, 42.4, 25.5, 42.8}`, ~40×45 км при Казанлък). За всичко извън него
`ndvi_mean` в `zones` е NULL, тоест NDVI корекцията в риск модела реално не участва —
рискът се смята само от FWI и fuel.

Предложение: **не** много сцени с 10 м резолюция, а една широка заявка с груба.
Риск клетките са ~8 км, така че 100–250 м на пиксел е предостатъчно — при теб това е
смяна на `BBOX` и на `width`/`height` в Process API заявката, не нова архитектура.
Ако решиш друго (мозайка от няколко сцени, друг източник), кажи каква ще е формата и
NDVI worker-ът се нагажда — той не се интересува колко на брой са сцените.

**2. dNBR producer (Фаза 3).** Worker-ът е готов и пуснат (`worker-dnbr`): чете
`analysis.tasks`, смята тежестта на изгарянето, пълни `burn_severity`. Липсва само кой да
пуска задачите — днес това става на ръка с mock-а.

Формата на съобщението е предложена в **раздел 10** на
[`message-contracts.md`](../../shared/schemas/message-contracts.md) — прегледай я **преди**
да пишеш producer-а, защото сега се сменя лесно, после не. Трябват ти: bucket + път до
двете сцени (преди/след), техните дати, `bands: ["B08","B12"]`, bbox и по избор `fire_id`.
Двете сцени трябва да са с еднакъв размер и обхват.

Предложение кога се пуска: когато пожар не е бил засичан N дни (тоест е угаснал), с
най-близките налични сцени преди началото и след края му.

### ⚠️ Отворено

- **NDVI покритието** и **producer-ът за dNBR** — двете са горе, в „За Backend".
- **SSH достъп за мен** — Pavlin да добави ключа ми, за тунел към сървъра.
- ⚠️ EFFIS data сървърът има **изтекъл SSL сертификат** — свалянето на fuel картата иска
  изключена cert проверка. Техен проблем, файлът е публичен държавен dataset.

### Фаза 2

Алармите и евакуационните маршрути са реализирани директно в Java — `backend/alerts` и
`EvacuationController`, без опашките `fire.alerts` / `evacuation.routes` от таблицата по-долу.
Тя описва първоначалния план, не текущия път на данните. `fire.detections` обаче се ползва
наистина (ingestion публикува, `FireStreamService` чете).

Тоест две от опашките в конфигурацията стоят без нито producer, нито consumer. Или се ползват,
или се махат — иначе документацията описва един път на данните, а кодът върви по друг.

---

## PostgreSQL (PostGIS + pgRouting)

Основна релационна база с пространствени разширения. Тук живеят `critical_infrastructure`, `roads`, `active_fires`, `alerts`.

| Параметър | Стойност |
|-----------|----------|
| Host | `100.116.156.92` |
| Port | `5432` |
| Database | `wiser` |
| User | `wiser` |
| Password | пита Pavlin (в `.env`) |

**Connection string:** 
postgresql://wiser:<PASSWORD>@100.116.156.92:5432/wiser

**Достъпни таблици:**

| Таблица | Описание |
|---------|----------|
| `critical_infrastructure` | Болници, училища, детски градини от OSM (точкови данни) |
| `roads` | Пътна мрежа от OSM (LineString) с `passable` flag за pgRouting |
| `active_fires` | Активни пожари с perimeter (Point + optional Polygon) |
| `alerts` | История на изпратените аларми, FK към `active_fires` |

**Extensions:** `postgis`, `pgrouting`, `plpgsql`

---

## TimescaleDB

Time-series база за метеорологични и качествени данни. 3-месечен retention.

| Параметър | Стойност |
|-----------|----------|
| Host | `100.116.156.92` |
| Port | `5433` |
| Database | `wiser_timeseries` |
| User | `wiser` |
| Password | същата като PostgreSQL |

**Connection string:**
`postgresql://wiser:<PASSWORD>@100.116.156.92:5433/wiser_timeseries`

---

## RabbitMQ

Message bus за pipeline-ите. vhost: `wiser`.

| Параметър | Стойност |
|-----------|----------|
| Host | `100.116.156.92` |
| Port | `5672` (AMQP) · `15672` (management UI) |
| User | `wiser` |
| Password | пита Pavlin (в `.env`) |

**Connection string:** `amqp://wiser:<PASSWORD>@100.116.156.92:5672/wiser`

### Exchanges и Queues

Всяка фаза има отделен exchange. Всяка опашка има DLQ (dead letter queue) за съобщения които са failed след retry.

**Phase 1 — Prevention:**

| Exchange | Queue | Routing Key | Consumer |
|----------|-------|-------------|----------|
| `weather.exchange` | `weather.ingest` | `weather.ingest` | Phase 1 worker — парсва ECMWF, изчислява FWI |
| `satellite.exchange` | `satellite.ingest` | `satellite.ingest` | Phase 1 worker — обработва Sentinel-2 за NDVI |

**Phase 2 — Active fire:**

| Exchange | Queue | Routing Key | Consumer |
|----------|-------|-------------|----------|
| `fire.exchange` | `fire.detections` | `fire.detections` | Phase 2 worker — валидира FIRMS детекции |
| `fire.exchange` | `fire.alerts` | `fire.alerts` | Phase 2 worker — генерира in-app alerts |
| `evacuation.exchange` | `evacuation.routes` | `evacuation.routes` | Phase 2 worker — pgRouting recalculation |

**Phase 3 — Analysis:**

| Exchange | Queue | Routing Key | Consumer |
|----------|-------|-------------|----------|
| `analysis.exchange` | `analysis.tasks` | `analysis.tasks` | Phase 3 worker — post-fire dNBR изчисления |

**Dead Letter Queues:**

Всяка основна опашка има съответен `.dlq`. При неуспешен processing съобщението отива в DLQ вместо да се загуби. DLQs: `weather.dlq`, `satellite.dlq`, `fire.detections.dlq`, `fire.alerts.dlq`, `evacuation.dlq`, `analysis.dlq`.

### Message format convention

Всички съобщения са **JSON UTF-8**. Препоръчителна обвивка:

```json
{
  "message_id": "uuid-v4",
  "timestamp": "2026-06-17T10:30:00Z",
  "source": "firms-poller",
  "payload": { /* специфично за queue-то */ }
}
```

---

## MinIO (S3-compatible blob storage)

За satellite imagery и обработени GIS продукти.

| Параметър | Стойност |
|-----------|----------|
| Endpoint | http://100.116.156.92:9000 |
| Console UI | http://100.116.156.92:9001 |
| Access Key | пита Pavlin (`MINIO_ROOT_USER` в `.env`) |
| Secret Key | пита Pavlin (`MINIO_ROOT_PASSWORD` в `.env`) |

**Buckets:**

| Bucket | Съдържание |
|--------|------------|
| `satellite-imagery` | Raw Sentinel-2 GeoTIFF файлове |
| `processed-products` | NDVI растери, dNBR изчисления, обработени продукти |

**S3 SDK конфигурация (Python пример):**
```python
import boto3

s3 = boto3.client(
    's3',
    endpoint_url='http://100.116.156.92:9000',
    aws_access_key_id='<MINIO_ROOT_USER>',
    aws_secret_access_key='<MINIO_ROOT_PASSWORD>',
    region_name='us-east-1'  # MinIO не я ползва, но boto3 я изисква
)
```

⚠️ При Azure миграция endpoint-ът ще се смени към Azure Blob Storage, но S3-съвместимият API позволява лесен преход.

---

## Observability

Списък за справка:

| Сервиз | URL | Цел |
|--------|-----|-----|
| Prometheus | http://100.116.156.92:9090 | Metrics query |
| Grafana | http://100.116.156.92:3000 | Dashboards + infrastructure alerts (Alerting → Alertmanager) |
| Kibana | http://100.116.156.92:5601 | Logs (ELK) |

---

## Получаване на credentials

`.env` файлът съдържа всички пароли. Той не е в Git (и никога няма да бъде).

Когато ти трябват credentials, питай Pavlin **в личен канал** (DM в Discord), **не в публичен**.

---

## Промени в инфраструктурата

Ако ти трябва:
- Нова таблица → отвори PR с миграция в `db/postgres/migrations/`
- Нов RabbitMQ queue → промени `infra/docker/rabbitmq/definitions.json`
- Нов MinIO bucket → промени `infra/docker/docker-compose.yml` (секция `minio-init`)

CI ще валидира промените, CD ще ги deploy-не автоматично.
