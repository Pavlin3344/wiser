# Wiser — Connection Guide за разработчици

Този документ описва как backend и data processing workers се свързват към инфраструктурните сервизи на Wiser.

## Достъп до сървъра

Всичко минава през **Tailscale VPN**. Без него няма достъп до нищо.
Setup: виж `docs/team/onboarding.md`.

### Къде какво живее (след миграцията към Azure)

⚠️ **Hetzner (`100.116.156.92`) вече НЕ държи базите, брокера и хранилището.** Те са в
Azure. На Hetzner остана само наблюдателният стек. Ако някой инструмент те праща към
`100.116.156.92:5432`, той чете стара документация — контейнерът `wiser-postgres` не
върви там от миграцията насам. (Определенията му стоят в `docker-compose.yml` под профил
`full`, за връщане назад, но профилът не се вдига.)

| Кое | Къде | Как се стига |
|---|---|---|
| Prometheus, Grafana, Kibana, Alertmanager, ELK | Hetzner `100.116.156.92` | директно по tailnet-а |
| PostgreSQL, TimescaleDB | Azure, частен endpoint в `10.60.0.0/21` | през subnet router-а — виж по-долу |
| RabbitMQ, MinIO | Azure Container Apps | по HTTPS на публичния им FQDN |
| api, frontend, всички job-ове | Azure Container Apps | — |

### Достъп до частните адреси в Azure (10.60.x)

Базите нямат публичен адрес (`public_network_access_enabled = false`). Стига се до тях
през `wiser-azure-router` — Tailscale subnet router вътре във VNet-а, който обявява
`10.60.0.0/21` в tailnet-а.

За да проработи, трябват **две** неща, и ако липсва което и да е от тях, симптомът е
един и същ — connection timeout, без съобщение за грешка:

1. **Маршрутът да е одобрен** в Tailscale admin console: Machines → `wiser-azure-router`
   → Subnet routes → `10.60.0.0/21`. Одобрението е за конкретна машина и **отпада, ако
   VM-ът бъде пресъздаден** (затова `custom_data` е под `ignore_changes` в
   `envs/prod/main.tf` — пресъздаването губи и tailnet идентичността, и одобрението).
2. **Твоята машина да приема маршрути**: `tailscale up --accept-routes`
   (Windows: Preferences → „Use subnet routes"). Без това пакетът тръгва по default
   route-а и излиза в интернет.

Проверка, че двете са налице:

```bash
tailscale status --json | grep -A3 wiser-azure-router   # трябва да се вижда 10.60.0.0/21
tailscale ping 10.60.2.6                                # трябва да отговори през router-а
```

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
пуска задачите.

Междувременно има ръчен заместник — `data/processing/dnbr/fetch_scene_pair.py`, пуска се
като job (`dnbr-scene-fetcher`). Намира изгорелия участък по детекциите в `active_fires`,
взима двойка реални сцени и публикува съобщението по контракта. Той е стълба, не решение:
пуска се от човек, за конкретен пожар. Формата, която праща, е точно долната — тоест
писането на истинския producer не иска промяна нито в worker-а, нито в контракта.

⚠️ И едно за преди да пишеш producer-а: `SentinelFetcherService` **не става за източник**.
Сваля B04 + B08 (за NDVI), а dNBR иска B08 + B12 и го проверява изрично — трябва му втори
evalscript. Обхватът също: закованият bbox `[25.0, 42.4, 25.5, 42.8]` почти никога няма да
съвпадне с пожар.

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

Azure Database for PostgreSQL Flexible Server, без публичен адрес.

| Параметър | Стойност |
|-----------|----------|
| Host | `10.60.2.6` (частен endpoint, само през subnet router-а) |
| Port | `5432` |
| Database | `wiser` |
| User | `wiser` |
| Password | пита Pavlin (`POSTGRES_PASSWORD`) |
| SSL | задължителен — `sslmode=require` |

**Connection string:**
`postgresql://wiser:<PASSWORD>@10.60.2.6:5432/wiser?sslmode=require`

Свързваме се по IP, а не по име. `psql-wiser-prod-postgres.postgres.database.azure.com`
се резолвва публично към адрес, който отказва връзка — private DNS зоната важи вътре във
VNet-а, а твоята машина пита публичния DNS. `sslmode=require` криптира, без да проверява
името в сертификата, така че IP-то не пречи; `verify-full` няма да мине.

```bash
psql "postgresql://wiser:<PASSWORD>@10.60.2.6:5432/wiser?sslmode=require"
```

Timeout вместо отговор почти винаги значи маршрут, не парола — виж „Достъп до частните
адреси в Azure" в началото на документа.

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

Отделен Flexible Server, също без публичен адрес. Портът е `5432`, а не `5433` — на
Hetzner двете бази делеха една машина и втората беше изместена; тук са два сървъра.

| Параметър | Стойност |
|-----------|----------|
| Host | `10.60.2.5` (частен endpoint) |
| Port | `5432` |
| Database | `wiser_timeseries` |
| User | `wiser` |
| Password | същата като PostgreSQL |
| SSL | задължителен — `sslmode=require` |

**Connection string:**
`postgresql://wiser:<PASSWORD>@10.60.2.5:5432/wiser_timeseries?sslmode=require`

---

## RabbitMQ

Message bus за pipeline-ите. vhost: `wiser`.

Върви като Container App в Azure. Ingress-ът е external по неприятна причина: в тази
среда internal-only ingress връща платформено 404 за всичко (виж коментара в
`modules/container-apps/messaging-storage.tf`). Паролата е това, което пази достъпа.

| Параметър | Стойност |
|-----------|----------|
| Host | `ca-wiser-prod-rabbitmq.ambitioussand-73e9150a.swedencentral.azurecontainerapps.io` |
| Port | `5672` (AMQP, през edge-а на 443) |
| vhost | `wiser` |
| User | `wiser` |
| Password | пита Pavlin (`RABBITMQ_PASSWORD`) |

Опашките се пресъздават от `definitions.json` при всеки старт — за `/var/lib/rabbitmq`
няма volume, защото Azure Files не може да наложи правата, които RabbitMQ иска на
`.erlang.cookie`. Тоест **натрупаните съобщения не преживяват рестарт**; топологията да.

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
| Endpoint | `https://ca-wiser-prod-minio.ambitioussand-73e9150a.swedencentral.azurecontainerapps.io` |
| Access Key | пита Pavlin (`MINIO_ROOT_USER`) |
| Secret Key | пита Pavlin (`MINIO_ROOT_PASSWORD`) |

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
    endpoint_url='https://ca-wiser-prod-minio.ambitioussand-73e9150a.swedencentral.azurecontainerapps.io',
    aws_access_key_id='<MINIO_ROOT_USER>',
    aws_secret_access_key='<MINIO_ROOT_PASSWORD>',
    region_name='us-east-1'  # MinIO не я ползва, но boto3 я изисква
)
```

ℹ️ Остава MinIO и в Azure, а не Blob Storage: същият образ и същият S3 API като на
Hetzner значи, че `data/processing/*/config.py` не се пипа при местене в която и да е от
двете посоки.

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
