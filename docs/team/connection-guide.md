# Wiser — Connection Guide за разработчици

Този документ описва как backend и data processing workers се свързват към инфраструктурните сервизи на Wiser.

## Достъп до сървъра

Всички сервизи са достъпни само през **Tailscale VPN**.

- **Сървър IP**: `100.116.156.92`
- Без Tailscale няма достъп до нищо

Setup на Tailscale: виж `docs/team/onboarding.md`.

---

## Фаза 1 — статус на интеграцията (Data Engineer ↔ Backend)

> Кратко: Data Engineer частта е **готова и тествана локално** срещу mock-ове.
> Сега е ред на Backend да пусне реалните producer-и, за да паднат mock-овете.
> Пълният договор: [`shared/schemas/message-contracts.md`](../../shared/schemas/message-contracts.md).

### ✅ Какво е готово (Data Engineer)

| Компонент | Чете | Пише |
|---|---|---|
| FWI worker | `weather.ingest` | TimescaleDB `fire_weather_index` |
| NDVI worker | `satellite.ingest` | MinIO `processed-products/ndvi/` |
| Fuel карта (EFFIS NFFL, само BG) | — | MinIO `processed-products/fuel/bg_fuel.tif` |
| Risk zones job | FWI + NDVI + fuel | PostGIS `zones` |
| Локален dev стек | `docker-compose.dev.yml` | — |

Worker-ите работят срещу **mock publisher-и**, които заместват още-неготовите ти producer-и.
Като пуснеш реалните — mock-овете просто спират, worker-ите не се пипат.

### 🔲 Какво трябва да направиш сега (Backend / Ицо)

1. **EFFIS/ECMWF downloader** → публикувай в `weather.ingest` по контракта (готов FWI, batch с масив точки). Отпушва FWI worker-а.
2. **Sentinel-2 fetcher** → качи GeoTIFF (канали `B04`+`B08`) в MinIO `satellite-imagery`, публикувай `satellite.ingest`. Отпушва NDVI worker-а.
3. **OSM importer** → напълни `critical_infrastructure` + `roads`.
4. **`zones` миграция** → `db/postgres/migrations/001_zones.sql`. Схемата е готова — копни я от `message-contracts.md` (раздел 6) или `data/processing/risk_zones/dev_schema.sql`. Аз ползвам локална dev таблица дотогава.
5. **REST endpoint** `GET /zones/risk` → сервира `zones` на frontend-а.

### ⚠️ Какво липсва / да се реши

- **4-те отворени точки** от договора (най-долу в `message-contracts.md`) — потвърди ги.
- **SSH достъп за мен** — Pavlin да добави ключа ми, за тунел към сървъра (дотогава работя локално).
- **Fuel = NFFL, не FirEUrisk** — EFFIS свалят NFFL кодовете (1–10); риск моделът е по тях.
- ⚠️ EFFIS data сървърът има **изтекъл SSL сертификат** — свалянето на fuel картата иска изключена cert проверка.

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
| Grafana | http://100.116.156.92:3000 | Dashboards |
| Kibana | http://100.116.156.92:5601 | Logs (ELK) |
| Alerta | http://100.116.156.92:8080 | Infrastructure alerts |
| Alertmanager | http://100.116.156.92:9093 | Alert routing |

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
