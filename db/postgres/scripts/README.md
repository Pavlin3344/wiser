# Roads import (OSM -> pgRouting)

Populates the `roads` table from real Bulgaria OpenStreetMap data, with routing
topology (`source`/`target`/`cost`/`reverse_cost`) built by `osm2pgrouting`.

This is a **documented manual pipeline**, not custom Java code, because
`osm2pgrouting` is the standard, purpose-built tool for turning OSM ways into
a routable network (splitting ways at intersections, assigning topology node
IDs) - reimplementing that correctly in Java would be a lot of surface area
for something a well-tested existing tool already solves.

## Why the extra filtering step

A full-country `.osm.pbf` (~170MB for Bulgaria) converts to several GB of XML,
and `osm2pgrouting`'s XML parser loads enough of that into memory that the
container gets OOM-killed on a whole-country extract. Filtering down to just
`highway=*` ways *before* converting to XML avoids this - and is also just a
better-shaped dataset for a routing table (a full extract is mostly
buildings/land-use/POIs, none of which belong in `roads` anyway).

## Pipeline

All steps run via Docker so nothing needs installing locally.

```bash
# 1. Download the Bulgaria extract
curl -L -o bulgaria-latest.osm.pbf https://download.geofabrik.de/europe/bulgaria-latest.osm.pbf

# 2. Filter to just highway ways (also pulls in their referenced nodes)
docker run --rm -v "$(pwd):/data" iboates/osmium:latest \
  tags-filter /data/bulgaria-latest.osm.pbf w/highway -o /data/bulgaria-roads.pbf --overwrite

# 3. Convert to XML (osm2pgrouting needs .osm, not .pbf)
docker run --rm -v "$(pwd):/data" iboates/osmium:latest \
  cat /data/bulgaria-roads.pbf -o /data/bulgaria-roads.osm -f osm --overwrite

# 4. Create a staging schema (once)
docker exec wiser-postgres psql -U wiser -d wiser -c "CREATE SCHEMA IF NOT EXISTS osm_staging;"

# 5. Run osm2pgrouting into the staging schema
#    (--network docker_default so the container can reach the postgres container by name)
docker run --rm --network docker_default -v "$(pwd):/data" pgrouting/pgrouting-extra:latest \
  osm2pgrouting -f /data/bulgaria-roads.osm \
    -c /usr/local/share/osm2pgrouting/mapconfig_for_cars.xml \
    -d wiser -U wiser -h postgres -p 5432 -W "$POSTGRES_PASSWORD" \
    --schema osm_staging --clean

# 6. Transform staging tables into the real `roads` table
docker exec -i wiser-postgres psql -U wiser -d wiser < import_roads_from_osm.sql
```

## Notes

- `mapconfig_for_cars.xml` is one of three profiles `osm2pgrouting` ships with
  (cars/bicycles/pedestrians) - it decides which `highway` tags count as
  routable and their default cost/speed. Cars is the right profile for
  evacuation routing.
- `osm_staging.ways.tag_id` joins to `osm_staging.configuration.tag_id` to
  recover the actual OSM `highway` tag value (e.g. `residential`, `primary`)
  for the `roads.highway` column.
- Re-running is safe: step 5 uses `--clean` (drops and recreates staging
  tables), and `import_roads_from_osm.sql` truncates `roads` before
  reinserting.
- This is a one-off/occasional import (OSM road data doesn't change often
  for Bulgaria), not something scheduled like the FIRMS ingestion.
