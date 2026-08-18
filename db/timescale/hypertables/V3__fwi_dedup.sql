-- The EFFIS downloader publishes the whole Bulgaria grid for one date per run, and its
-- @Scheduled job fires immediately on container start. Every redeploy therefore wrote a
-- second full copy of the same grid for the same day, with nothing to stop it: the table
-- has no unique index, and the FWI worker inserts blindly. The risk-zones job papered over
-- this with DISTINCT ON, but every cell was being stored twice.
--
-- A unique index lets the writer use ON CONFLICT DO NOTHING and stay idempotent, the same
-- way air_quality already does (V2). Hypertable uniqueness must include the partitioning
-- column (time), which it does.

-- Existing duplicates have to go first, or the index cannot be built. DISTINCT ON keeps one
-- row per (time, lat, lon, source) - plain DISTINCT would not, since two runs of the same
-- grid can carry slightly different fwi values for the same point.
--
-- Rebuild-via-temp-table rather than a ctid self-join: ctid is a per-chunk physical address
-- on a hypertable, and this migration blocks the whole stack from starting if it fails.
CREATE TEMP TABLE fwi_deduped AS
    SELECT DISTINCT ON (time, lat, lon, source) time, lat, lon, source, fwi, class
    FROM fire_weather_index
    ORDER BY time, lat, lon, source;

DELETE FROM fire_weather_index;

INSERT INTO fire_weather_index (time, lat, lon, source, fwi, class)
    SELECT time, lat, lon, source, fwi, class FROM fwi_deduped;

DROP TABLE fwi_deduped;

CREATE UNIQUE INDEX IF NOT EXISTS fire_weather_index_unique_point
    ON fire_weather_index (time, lat, lon, source);
