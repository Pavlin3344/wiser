-- The air quality poller runs hourly and Open-Meteo returns the same hourly reading
-- until the next one is published, so a retry or an overlapping run would otherwise
-- insert the same observation twice. A unique index lets the writer use
-- ON CONFLICT DO NOTHING and stay idempotent.
--
-- Hypertable uniqueness must include the partitioning column (time), which it does.
CREATE UNIQUE INDEX IF NOT EXISTS air_quality_unique_reading
    ON air_quality (time, lat, lon, source);
