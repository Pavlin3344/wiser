-- Риск зони (Fire Weather Index + NDVI + fuel), виж shared/schemas/message-contracts.md раздел 6-7
CREATE TABLE IF NOT EXISTS zones (
    id          SERIAL PRIMARY KEY,
    geom        GEOMETRY(Polygon, 4326),
    fwi_class   SMALLINT,
    fwi_value   FLOAT,
    ndvi_mean   FLOAT,
    fuel_type   INTEGER,
    risk_class  SMALLINT,
    risk_score  FLOAT,
    computed_at TIMESTAMPTZ,
    valid_date  DATE
);
CREATE INDEX ON zones USING GIST (geom);
CREATE INDEX ON zones (valid_date);
