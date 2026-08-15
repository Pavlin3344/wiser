package com.wisertech.api;

import java.util.Optional;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class EvacuationRepository {

    private static final String TOPOLOGY_COUNT_SQL = """
        SELECT COUNT(*) FROM roads WHERE source IS NOT NULL AND target IS NOT NULL
        """;

    // Ordering by the KNN operator (<->) lets Postgres use the GIST index on geom to
    // find the closest road first, then we pick whichever of its two endpoints is nearer.
    private static final String NEAREST_VERTEX_SQL = """
        SELECT CASE
                   WHEN ST_Distance(ST_StartPoint(geom), pt.p) <= ST_Distance(ST_EndPoint(geom), pt.p)
                   THEN source ELSE target
               END AS vertex_id
        FROM roads, (SELECT ST_SetSRID(ST_MakePoint(?, ?), 4326) AS p) AS pt
        WHERE source IS NOT NULL AND target IS NOT NULL AND passable = true
        ORDER BY geom <-> pt.p
        LIMIT 1
        """;

    private static final String ROUTE_SQL = """
        SELECT ST_AsGeoJSON(ST_LineMerge(ST_Collect(r.geom ORDER BY d.seq))) AS geom_json,
               SUM(d.cost) AS total_cost,
               COUNT(*) AS segments
        FROM pgr_dijkstra(
                 'SELECT id, source, target, cost, reverse_cost FROM roads
                   WHERE passable = true AND source IS NOT NULL AND target IS NOT NULL',
                 ?, ?, directed := true
             ) d
        JOIN roads r ON r.id = d.edge
        """;

    private final JdbcTemplate jdbcTemplate;

    public EvacuationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean hasRoutingTopology() {
        Long count = jdbcTemplate.queryForObject(TOPOLOGY_COUNT_SQL, Long.class);
        return count != null && count > 0;
    }

    public Optional<Integer> findNearestVertex(double lng, double lat) {
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(NEAREST_VERTEX_SQL, Integer.class, lng, lat));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<RouteRow> findShortestPath(int startVertex, int endVertex) {
        RouteRow row = jdbcTemplate.query(ROUTE_SQL, rs -> {
            if (!rs.next() || rs.getString("geom_json") == null) {
                return null;
            }
            return new RouteRow(rs.getString("geom_json"), rs.getDouble("total_cost"), rs.getInt("segments"));
        }, startVertex, endVertex);
        return Optional.ofNullable(row);
    }

    public record RouteRow(String geometryJson, double totalCost, int segments) {
    }
}
