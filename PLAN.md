# FireWatch Backend — Build Plan

Tracks every component across `backend/api` and `backend/ingestion` for the team review.
Checked = built and verified working against the real local stack. See `NOTES.md` for what each piece does and why.

## Database (Postgres/PostGIS)

- [x] `V1__init.sql` — critical_infrastructure, roads, active_fires, alerts tables (pre-existing)
- [x] `V2__zones.sql` — risk zones table, per team contract (`shared/schemas/message-contracts.md` §6)

## backend/api

- [x] `ActiveFire` entity (JTS `Point` geometry)
- [x] `ActiveFireRepository`
- [x] `ActiveFireController` — `GET /api/active-fires`, `POST /api/active-fires`
- [x] `PointSerializer` — GeoJSON output for `Point` fields (Jackson 3 custom serializer)
- [x] `Zone` entity (JTS `Polygon` geometry)
- [x] `ZoneRepository`
- [x] `ZoneController` — `GET /zones/risk`
- [x] `PolygonSerializer` — GeoJSON output for `Polygon` fields
- [x] `Alert` entity
- [x] `AlertRepository`
- [x] `AlertController` — `GET /api/alerts`
- [x] `CriticalInfrastructure` entity + repository + controller — `GET /api/critical-infrastructure`
- [x] `Road` entity + repository + controller — `GET /api/roads` (+ `LineStringSerializer`)

## backend/ingestion

- [x] Service scaffold (pom.xml, application.properties, main class, RabbitMQ + JPA + S3 deps)
- [x] `CriticalInfrastructure` entity (ingestion's own copy) + repository
- [x] `OsmImportService` + `OsmImportController` — `POST /import/critical-infrastructure` (Overpass API → Bulgaria hospitals/schools/kindergartens). Verified live: 591 real records (232 schools, 198 hospitals, 161 kindergartens) after `overpass-api.de` recovered from its outage.
- [x] Roads import — `osm2pgrouting` CLI (via Docker) against a Bulgaria OSM extract, filtered to highway ways first to avoid OOM on the full country. Verified: 864,030 real road segments in `roads`, with routing topology (source/target/cost/reverse_cost). Documented in `db/postgres/scripts/README.md`, not custom code.
- [ ] EFFIS/ECMWF downloader → `weather.exchange`/`weather.ingest` — **blocked**: need to confirm `maps.effis.emergency.copernicus.eu` is reachable from your machine
- [x] `MinioConfig` — S3Client bean pointed at MinIO (path-style access, since MinIO isn't virtual-hosted-style)
- [x] `SentinelFetcherService` + `SentinelFetcherController` — OAuth2 (Copernicus CDSE) → Sentinel Hub Process API (real Sentinel-2 L2A GeoTIFF, B04+B08) → MinIO upload → `satellite.exchange`/`satellite.ingest` publish. `@Scheduled` every ~3 days + manual trigger (`POST /import/sentinel-scene`). **Live-verified**: real 1.3MiB GeoTIFF landed in MinIO (`satellite-imagery/sentinel2/2026-07-31/T34TGN.tif`), 1 message confirmed in the `satellite.ingest` queue. Uses the same bbox/tile as the Data Engineer's own NDVI test fixture (`data/processing/ndvi/mock_publisher.py`) so real output lands exactly where their worker was already tested against.

### NASA FIRMS active-fire ingestion (new scope, 2026-07-27)

- [x] `ActiveFire` entity (ingestion's own copy, PostGIS Point + attributes)
- [x] `FireDetectionProvider` interface (abstraction over "a source of fire detections") + `FirmsFireDetectionProvider` implementation (only implementation for now)
- [x] Spatial dedup query on the repository (`ST_Equals`-based)
- [x] `FireIngestionService` — hourly `@Scheduled` poll + manual trigger endpoint (`POST /import/fire-detections`). **Live-verified with a real FIRMS_MAP_KEY**: 4 real MODIS_NRT detections imported on first run, confirmed via `GET /api/active-fires` (real Bulgaria coordinates, timestamps, confidence, FRP).

## backend/alerts (Phase 2 — lower priority per team docs, stretch goal for this review)

- [x] Service scaffold (port 8082)
- [x] `ActiveFire` + `CriticalInfrastructure` entities (read-only copies) + `Alert` entity (writable)
- [x] `CriticalInfrastructureRepository.findWithinDistance` — native `ST_DWithin` query on `geography` (real-world meters, not degrees)
- [x] `AlertGenerationService` — hourly job: for each fire, find nearby critical infrastructure (default 5km, configurable), create an `Alert` if one doesn't already exist for that fire+target pair, with distance-based severity (critical/high/medium). Manual trigger: `POST /generate-alerts`. Not an official team spec — Phase 2 alert design isn't finalized per `docs/team/connection-guide.md`, so this is a clearly-scoped prototype, not a contract implementation.
- **Live-verified**: 133 real alerts generated from real fires + real infrastructure (87 medium, 36 high, 10 critical), visible via `api`'s existing `GET /api/alerts`; reran with 0 new alerts confirming dedup works.

## Infra gap found (flagging for the team, not fixed in shared config)

`infra/docker/rabbitmq/rabbitmq.conf` sets `load_definitions`, and when that's set, RabbitMQ **skips seeding the default user from `RABBITMQ_DEFAULT_USER`/`RABBITMQ_DEFAULT_PASS`** entirely — regardless of whether `definitions.json` itself defines any users. Since `definitions.json` deliberately has no `users` section (comment: "credentials come from env"), a fresh `rabbitmq_data` volume boots with **no user at all**, and every login fails with "invalid credentials". Worked around locally with `rabbitmqctl add_user`/`set_permissions` (not committed - a manual step against the running container, lost if the volume is recreated). Whoever owns `infra/docker/rabbitmq/` should decide the real fix (likely: define users directly in `definitions.json`, accepting that credential in git, or find RabbitMQ's supported way to combine definitions-import with env-var user seeding).

## Out of scope for this review

Auth, retry/dead-letter handling beyond what RabbitMQ gives for free, real notification delivery (email/push).
