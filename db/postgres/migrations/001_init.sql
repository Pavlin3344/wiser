CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- Критична инфраструктура (от OSM)
CREATE TABLE IF NOT EXISTS critical_infrastructure (
    id          BIGSERIAL PRIMARY KEY,
    osm_id      BIGINT UNIQUE,
    name        TEXT,
    type        TEXT NOT NULL,
    geom        GEOMETRY(Point, 4326) NOT NULL,
    properties  JSONB,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON critical_infrastructure USING GIST (geom);
CREATE INDEX ON critical_infrastructure (type);

-- Пътна мрежа (от OSM — за pgRouting)
CREATE TABLE IF NOT EXISTS roads (
    id           BIGSERIAL PRIMARY KEY,
    osm_id       BIGINT,
    name         TEXT,
    highway      TEXT,
    source       INTEGER,
    target       INTEGER,
    cost         FLOAT,
    reverse_cost FLOAT,
    passable     BOOLEAN DEFAULT TRUE,
    geom         GEOMETRY(LineString, 4326) NOT NULL
);
CREATE INDEX ON roads USING GIST (geom);
CREATE INDEX ON roads (passable);

-- Активни пожари
CREATE TABLE IF NOT EXISTS active_fires (
    id           BIGSERIAL PRIMARY KEY,
    source       TEXT NOT NULL,
    detected_at  TIMESTAMPTZ NOT NULL,
    confidence   SMALLINT,
    frp          FLOAT,
    geom         GEOMETRY(Point, 4326) NOT NULL,
    perimeter    GEOMETRY(Polygon, 4326),
    properties   JSONB
);
CREATE INDEX ON active_fires USING GIST (geom);
CREATE INDEX ON active_fires (detected_at DESC);

-- История на алармите
CREATE TABLE IF NOT EXISTS alerts (
    id              BIGSERIAL PRIMARY KEY,
    fire_id         BIGINT REFERENCES active_fires(id),
    alert_type      TEXT NOT NULL,
    severity        TEXT NOT NULL,
    target_type     TEXT,
    target_id       BIGINT,
    message         TEXT,
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ
);
CREATE INDEX ON alerts (fire_id);
CREATE INDEX ON alerts (sent_at DESC);
