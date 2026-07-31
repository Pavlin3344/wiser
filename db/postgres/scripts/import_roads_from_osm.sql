-- Populates the `roads` table from an osm2pgrouting staging import.
-- Run osm2pgrouting into the osm_staging schema first (see README.md in
-- this folder for the full pipeline), then run this script.
TRUNCATE roads RESTART IDENTITY;

INSERT INTO roads (osm_id, name, highway, source, target, cost, reverse_cost, passable, geom)
SELECT
    w.osm_id,
    w.name,
    c.tag_value AS highway,
    w.source::integer,
    w.target::integer,
    w.cost,
    w.reverse_cost,
    true AS passable,
    w.geom
FROM osm_staging.ways w
LEFT JOIN osm_staging.configuration c ON w.tag_id = c.tag_id;
