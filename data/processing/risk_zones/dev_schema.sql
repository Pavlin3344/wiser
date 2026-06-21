-- ЛОКАЛЕН dev schema за таблицата `zones`.
-- Официалната миграция е на бекенда (db/postgres/migrations/001_zones.sql,
-- виж shared/schemas/message-contracts.md раздел 6). Този файл е само за
-- локална разработка, докато бекендът я напише.
CREATE TABLE IF NOT EXISTS zones (
    id          SERIAL PRIMARY KEY,
    geom        GEOMETRY(Polygon, 4326),
    fwi_class   SMALLINT,
    fwi_value   FLOAT,
    ndvi_mean   FLOAT,
    fuel_type   INTEGER,
    risk_class  SMALLINT,   -- 1-6, крайният клас за картата
    risk_score  FLOAT,      -- непрекъсната стойност
    computed_at TIMESTAMPTZ,
    valid_date  DATE
);
CREATE INDEX IF NOT EXISTS zones_geom_gist ON zones USING GIST (geom);
CREATE INDEX IF NOT EXISTS zones_valid_date ON zones (valid_date);
