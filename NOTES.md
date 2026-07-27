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

**`Alert` entity** *(in progress)*: Maps to the `alerts` table (fire ID reference, alert type, severity, message, timestamps). Exists so the dashboard can eventually show alert history. Talks to: Postgres; will talk to whatever future service (Phase 2 `backend/alerts`) actually creates alert rows.

## backend/ingestion

**Service scaffold**: A second, independent Spring Boot app (own `pom.xml`, own port `8081`) alongside `backend/api`. It exists because ingestion's job — pulling external data in and publishing/writing it — is a different responsibility from serving the dashboard's API, and the team's architecture already treats them as separate services. Talks to: the same Postgres database as `api` (shared tables), plus RabbitMQ and MinIO (not yet wired up).

**`CriticalInfrastructure` entity + repository** (ingestion's own copy): Maps to the same `critical_infrastructure` table `api` will eventually read from. It's a separate class from any future `api`-side entity because each service in this architecture owns its own Java model of shared tables — normal for microservices, avoids a shared library dependency between services.

**`OsmImportService` / `OsmImportController`**: Calls the public Overpass API with a query scoped to Bulgaria, asking for hospital/school/kindergarten nodes, then saves each as a `CriticalInfrastructure` row (skipping ones already imported by OSM ID, so re-running is safe). Exists to satisfy the "OSM importer" item in the team's Phase 1 responsibilities. Talks to: `overpass-api.de` (public, no auth) and Postgres.
