-- Тежест на изгарянето след пожар (dNBR) — Фаза 3.
-- Пише: dNBR worker-ът (`data/processing/dnbr`). Растерът остава в MinIO, тук стои
-- обобщението, за да може бекендът да го сервира без да чете GeoTIFF.
-- Контракт: shared/schemas/message-contracts.md, раздел „Фаза 3".
CREATE TABLE IF NOT EXISTS burn_severity (
    id                SERIAL PRIMARY KEY,
    fire_id           BIGINT REFERENCES active_fires(id) ON DELETE SET NULL,
    geom              GEOMETRY(Polygon, 4326),   -- обхватът на анализа
    pre_date          DATE NOT NULL,             -- сцената преди пожара
    post_date         DATE NOT NULL,             -- сцената след пожара
    raster_path       TEXT NOT NULL,             -- ключ в MinIO `processed-products`
    mean_dnbr         FLOAT,
    burned_hectares   FLOAT,                     -- сборът на класове 3–6
    analysed_hectares FLOAT,                     -- площта с данни (без празните пиксели)
    ha_regrowth       FLOAT,                     -- клас 1
    ha_unburned       FLOAT,                     -- клас 2
    ha_low            FLOAT,                     -- клас 3
    ha_moderate_low   FLOAT,                     -- клас 4
    ha_moderate_high  FLOAT,                     -- клас 5
    ha_high           FLOAT,                     -- клас 6
    computed_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS burn_severity_geom_idx ON burn_severity USING GIST (geom);
CREATE INDEX IF NOT EXISTS burn_severity_fire_idx ON burn_severity (fire_id);

-- Един анализ на двойка сцени за даден пожар. Преработка на същата двойка (по-добри
-- сцени, поправен модел) обновява реда вместо да трупа нов - същият урок като при
-- `fire_weather_index`: без уникален индекс всяко повторно пускане дублира данните.
--
-- NULLS NOT DISTINCT е заради анализите без конкретен пожар (fire_id IS NULL): по
-- подразбиране Postgres брои всеки NULL за различен и такива редове биха се дублирали.
CREATE UNIQUE INDEX IF NOT EXISTS burn_severity_unique_analysis
    ON burn_severity (fire_id, pre_date, post_date) NULLS NOT DISTINCT;
