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
- [ ] RabbitMQ publisher service (shared plumbing for both downloaders below)
- [ ] EFFIS/ECMWF downloader → `weather.exchange`/`weather.ingest` — **blocked**: need to confirm `maps.effis.emergency.copernicus.eu` is reachable from your machine
- [ ] Sentinel-2 fetcher → MinIO + `satellite.exchange`/`satellite.ingest` — **blocked**: need your Copernicus Data Space OAuth Client ID/Secret
- [ ] `@Scheduled` triggers (EFFIS: daily, Sentinel-2: ~every 2-3 days)

### NASA FIRMS active-fire ingestion (new scope, 2026-07-27)

- [x] `ActiveFire` entity (ingestion's own copy, PostGIS Point + attributes)
- [x] `FireDetectionProvider` interface (abstraction over "a source of fire detections") + `FirmsFireDetectionProvider` implementation (only implementation for now)
- [x] Spatial dedup query on the repository (`ST_Equals`-based)
- [x] `FireIngestionService` — hourly `@Scheduled` poll + manual trigger endpoint (`POST /import/fire-detections`). Verified: runs cleanly, logs a clear warning and no-ops with the placeholder key.
- [ ] **Blocked**: need a real FIRMS `MAP_KEY` — register at https://firms.modaps.eosdis.nasa.gov/api/area/ ; using a placeholder env var until then

## backend/alerts (Phase 2 — lower priority per team docs, stretch goal for this review)

- [ ] Service scaffold
- [ ] Alert-generation logic (not yet designed — Phase 2 per `docs/team/connection-guide.md`)

## Out of scope for this review

Auth, retry/dead-letter handling beyond what RabbitMQ gives for free, real notification delivery (email/push).
