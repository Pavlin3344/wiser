# FireWatch Backend — Component Notes

Plain-English notes per component: what it does, why it exists, what it talks to. Written for the team review — see `PLAN.md` for build status.

## Database

**`V1__init.sql`** (pre-existing): Creates the four core PostGIS tables — `critical_infrastructure`, `roads`, `active_fires`, `alerts` — plus the `postgis`/`pgrouting` extensions. It exists because every other piece of the backend reads or writes one of these tables.

**`V2__zones.sql`**: Creates the `zones` table, which stores computed fire-risk polygons (one row per zone, with an `fwi_class`/`risk_class` and the geometry). It exists to unblock the Data Engineer's risk-zones job, which was writing to a local `dev_schema.sql` copy until this migration landed. Talks to: the Data Engineer's Python job (writer) and `ZoneController` (reader).

## backend/api

**`ActiveFire` entity**: Maps Java objects to rows in the `active_fires` table — one object per detected fire (source, detection time, confidence, fire radiative power, and a JTS `Point` for location). It exists so the rest of the code can work with typed Java objects instead of raw SQL. Talks to: Postgres (via Hibernate), `ActiveFireRepository`.

**`ActiveFireRepository`**: A Spring Data JPA interface giving free CRUD operations (`save`, `findAll`, etc.) over `ActiveFire`, with zero hand-written SQL. Exists purely as the data-access layer between the controller and the database.

**`ActiveFireController`**: Exposes `GET /api/active-fires` (list all) and `POST /api/active-fires` (create one, building a JTS `Point` from posted lat/lon) over HTTP. It's the thing the frontend dashboard actually calls. Talks to: `ActiveFireRepository`, and the outside world via JSON.

**`PointSerializer`**: A custom Jackson serializer that turns a JTS `Point` into standard GeoJSON (`{"type":"Point","coordinates":[lon,lat]}`). Exists because JTS geometry objects aren't plain data classes — Jackson's normal getter-scanning breaks on them — so this tells Jackson explicitly how to write one out. Talks to: any controller returning an entity with a `Point` field.

**`Zone` entity / `ZoneRepository` / `ZoneController`**: Same pattern as Fires, for the `zones` table. `ZoneController` exposes `GET /zones/risk`, the exact endpoint name the team contract specifies, so the frontend can render risk-zone polygons.

**`PolygonSerializer`**: Same idea as `PointSerializer`, but for JTS `Polygon` → GeoJSON Polygon coordinates. Currently only serializes the exterior ring (no holes) — a known simplification, fine for the MVP risk-zone shapes.

**`Alert` entity / `AlertRepository` / `AlertController`**: Maps to the `alerts` table and exposes `GET /api/alerts`, read-only for now. Exists so the dashboard can show alert history once something actually writes rows there — that's Phase 2 work per the team docs, not built yet.

**`CriticalInfrastructure` entity / repository / controller** (api's copy): Exposes `GET /api/critical-infrastructure`, reading whatever `ingestion`'s OSM importer has written. Reuses `PointSerializer` since it's also a `Point`-geometry entity.

**`Road` entity / repository / controller / `LineStringSerializer`**: Exposes `GET /api/roads`. Roads are the third JTS geometry type in this codebase — a `LineString` (an ordered sequence of points forming a path), as opposed to `Point` (Fires, Critical Infrastructure) or `Polygon` (Zones). `LineStringSerializer` follows the exact same custom-Jackson-serializer pattern as the other two.

## backend/ingestion

**Service scaffold**: A second, independent Spring Boot app (own `pom.xml`, own port `8081`) alongside `backend/api`. It exists because ingestion's job — pulling external data in and publishing/writing it — is a different responsibility from serving the dashboard's API, and the team's architecture already treats them as separate services. Talks to: the same Postgres database as `api` (shared tables), plus RabbitMQ and MinIO (not yet wired up).

**`CriticalInfrastructure` entity + repository** (ingestion's own copy): Maps to the same `critical_infrastructure` table `api` will eventually read from. It's a separate class from any future `api`-side entity because each service in this architecture owns its own Java model of shared tables — normal for microservices, avoids a shared library dependency between services.

**`OsmImportService` / `OsmImportController`**: Calls the public Overpass API with a query scoped to Bulgaria, asking for hospital/school/kindergarten nodes, then saves each as a `CriticalInfrastructure` row (skipping ones already imported by OSM ID, so re-running is safe). Exists to satisfy the "OSM importer" item in the team's Phase 1 responsibilities. Talks to: `overpass-api.de` (public, no auth) and Postgres.

**`ActiveFire` entity** (ingestion's copy): Same table as `api`'s `ActiveFire`, but this one is ingestion's write-side model — one object per satellite-detected hotspot (source, detection time, confidence, fire radiative power, location).

**`FireDetectionProvider` / `FirmsFireDetectionProvider`**: `FireDetectionProvider` is a one-method interface — "give me the latest fire detections" — so a second data source can be added later without touching the service that calls it. `FirmsFireDetectionProvider` is the only implementation right now: it calls NASA FIRMS's Area CSV API (MODIS, Bulgaria bounding box, 1-day lookback) and parses each row into an `ActiveFire`. Talks to: `firms.modaps.eosdis.nasa.gov` (needs a free `MAP_KEY`, currently a placeholder — see PLAN.md).

**`ActiveFireRepository.existsDuplicate`** (ingestion): A hand-written spatial query (`ST_Equals` plus source+timestamp) that answers "have I already saved this exact hotspot?" — needed because FIRMS gives no stable ID per detection, and hourly polling with a 1-day lookback means the same hotspot reappears across runs.

**`FireIngestionService` / `FireIngestionController`**: The service layer — calls the provider, skips duplicates via the repository check, saves the rest, and is scheduled to run automatically once an hour (`@Scheduled`). The controller adds a manual `POST /import/fire-detections` trigger so a run can be tested without waiting for the clock.

**`db/postgres/scripts/import_roads_from_osm.sql` + README**: Populates `roads` with real Bulgaria road data and routing topology, using `osm2pgrouting` (the standard tool for this, not custom code) via Docker, then a SQL transform into our actual `roads` schema. The README documents the full pipeline: download a Geofabrik extract, filter to just `highway=*` ways with `osmium tags-filter` (a full country extract OOM-kills `osm2pgrouting`'s XML parser — filtering first avoids that and is also just a better-shaped dataset for routing), convert to XML, run `osm2pgrouting` into a staging schema, then run this script to transform into `roads`. One-off/occasional, not scheduled.
