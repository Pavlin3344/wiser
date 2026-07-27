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
- [ ] `AlertRepository`
- [ ] `AlertController` — `GET /api/alerts`
- [ ] `CriticalInfrastructure` entity + repository + controller — `GET /api/critical-infrastructure`
- [ ] `Road` entity + repository + controller — `GET /api/roads` (+ `LineStringSerializer`)

## backend/ingestion

- [x] Service scaffold (pom.xml, application.properties, main class, RabbitMQ + JPA + S3 deps)
- [x] `CriticalInfrastructure` entity (ingestion's own copy) + repository
- [x] `OsmImportService` + `OsmImportController` — `POST /import/critical-infrastructure` (Overpass API → Bulgaria hospitals/schools/kindergartens). Code complete; live run pending `overpass-api.de` recovering from a server-side outage.
- [ ] Roads import — via `osm2pgrouting` CLI against a Bulgaria OSM extract (not custom code — see NOTES.md)
- [ ] RabbitMQ publisher service (shared plumbing for both downloaders below)
- [ ] EFFIS/ECMWF downloader → `weather.exchange`/`weather.ingest` — **blocked**: need to confirm `maps.effis.emergency.copernicus.eu` is reachable from your machine
- [ ] Sentinel-2 fetcher → MinIO + `satellite.exchange`/`satellite.ingest` — **blocked**: need your Copernicus Data Space OAuth Client ID/Secret
- [ ] `@Scheduled` triggers (EFFIS: daily, Sentinel-2: ~every 2-3 days)

## backend/alerts (Phase 2 — lower priority per team docs, stretch goal for this review)

- [ ] Service scaffold
- [ ] Alert-generation logic (not yet designed — Phase 2 per `docs/team/connection-guide.md`)

## Out of scope for this review

Auth, retry/dead-letter handling beyond what RabbitMQ gives for free, real notification delivery (email/push).
