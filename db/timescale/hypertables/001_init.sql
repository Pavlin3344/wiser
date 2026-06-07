CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS weather_observations (
    time          TIMESTAMPTZ NOT NULL,
    lat           FLOAT,
    lon           FLOAT,
    source        TEXT,
    temperature   FLOAT,
    humidity      FLOAT,
    wind_speed    FLOAT,
    wind_dir      FLOAT,
    precipitation FLOAT,
    soil_moisture FLOAT
);
SELECT create_hypertable('weather_observations', 'time', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS fire_weather_index (
    time   TIMESTAMPTZ NOT NULL,
    lat    FLOAT,
    lon    FLOAT,
    source TEXT,
    fwi    FLOAT,
    class  SMALLINT
);
SELECT create_hypertable('fire_weather_index', 'time', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS air_quality (
    time   TIMESTAMPTZ NOT NULL,
    lat    FLOAT,
    lon    FLOAT,
    source TEXT,
    no2    FLOAT,
    pm25   FLOAT,
    pm10   FLOAT,
    co     FLOAT
);
SELECT create_hypertable('air_quality', 'time', if_not_exists => TRUE);

SELECT add_retention_policy('weather_observations', INTERVAL '3 months', if_not_exists => TRUE);
SELECT add_retention_policy('fire_weather_index',   INTERVAL '3 months', if_not_exists => TRUE);
SELECT add_retention_policy('air_quality',          INTERVAL '3 months', if_not_exists => TRUE);
