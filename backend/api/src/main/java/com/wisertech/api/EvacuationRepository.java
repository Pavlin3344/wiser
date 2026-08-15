package com.wisertech.api;

import java.util.ArrayList;
import java.util.List;
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

    /**
     * Assembly points to evacuate towards: known critical infrastructure that is not
     * itself inside the fire buffer. Sending people to a school that is about to burn
     * would be worse than sending them nowhere.
     */
    private static final String SAFE_DESTINATIONS_SQL = """
        WITH origin AS (SELECT ST_SetSRID(ST_MakePoint(?, ?), 4326) AS p),
        safe AS (
            SELECT ci.id, ci.name, ci.type, ci.geom
            FROM critical_infrastructure ci, origin
            WHERE NOT EXISTS (
                SELECT 1 FROM active_fires f
                WHERE ST_DWithin(ci.geom::geography, f.geom::geography, ?)
            )
            ORDER BY ci.geom <-> origin.p
            LIMIT ?
        )
        SELECT s.id, s.name, s.type,
               ST_X(s.geom) AS lng, ST_Y(s.geom) AS lat,
               (SELECT CASE
                           WHEN ST_Distance(ST_StartPoint(r.geom), s.geom) <= ST_Distance(ST_EndPoint(r.geom), s.geom)
                           THEN r.source ELSE r.target
                       END
                FROM roads r
                WHERE r.source IS NOT NULL AND r.target IS NOT NULL AND r.passable = true
                ORDER BY r.geom <-> s.geom
                LIMIT 1) AS vertex_id
        FROM safe s
        """;

    /**
     * One Dijkstra call for all destinations at once. The inner edge query drops any
     * road running within the fire buffer, so a returned route is one that does not
     * pass beside an active fire - that is the whole point of routing here rather than
     * drawing a straight line.
     */
    private static final String ROUTES_AVOIDING_FIRES_SQL = """
        SELECT d.end_vid,
               ST_AsGeoJSON(ST_LineMerge(ST_Collect(r.geom ORDER BY d.seq))) AS geom_json,
               SUM(d.cost) AS total_cost,
               COUNT(*) AS segments
        FROM pgr_dijkstra(
                 'SELECT r.id, r.source, r.target, r.cost, r.reverse_cost
                    FROM roads r
                   WHERE r.passable = true AND r.source IS NOT NULL AND r.target IS NOT NULL
                     AND NOT EXISTS (
                           SELECT 1 FROM active_fires f
                            WHERE ST_DWithin(r.geom::geography, f.geom::geography, %f)
                     )',
                 ?, ?, directed := true
             ) d
        JOIN roads r ON r.id = d.edge
        GROUP BY d.end_vid
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

    public List<Destination> findSafeDestinations(double lng, double lat, double fireBufferMeters, int limit) {
        return jdbcTemplate.query(SAFE_DESTINATIONS_SQL, (rs, rowNum) -> new Destination(
                rs.getLong("id"),
                rs.getString("name"),
                rs.getString("type"),
                rs.getDouble("lng"),
                rs.getDouble("lat"),
                rs.getObject("vertex_id") != null ? rs.getInt("vertex_id") : null),
                lng, lat, fireBufferMeters, limit);
    }

    public List<EvacuationRoute> findRoutesAvoidingFires(int startVertex, List<Integer> endVertices, double fireBufferMeters) {
        if (endVertices.isEmpty()) {
            return List.of();
        }
        // fireBufferMeters is a configured double, never user text, so formatting it into
        // the nested edge query cannot carry injected SQL.
        String sql = ROUTES_AVOIDING_FIRES_SQL.formatted(fireBufferMeters);
        Integer[] ends = endVertices.toArray(new Integer[0]);

        return jdbcTemplate.query(sql, ps -> {
            ps.setInt(1, startVertex);
            ps.setArray(2, ps.getConnection().createArrayOf("integer", ends));
        }, (rs, rowNum) -> new EvacuationRoute(
                rs.getInt("end_vid"),
                rs.getString("geom_json"),
                rs.getDouble("total_cost"),
                rs.getInt("segments")));
    }

    public record RouteRow(String geometryJson, double totalCost, int segments) {
    }

    public record Destination(Long id, String name, String type, double lng, double lat, Integer vertexId) {
    }

    public record EvacuationRoute(int endVertex, String geometryJson, double totalCost, int segments) {
    }

    static List<Integer> routableVertices(List<Destination> destinations) {
        List<Integer> vertices = new ArrayList<>();
        for (Destination d : destinations) {
            if (d.vertexId() != null && !vertices.contains(d.vertexId())) {
                vertices.add(d.vertexId());
            }
        }
        return vertices;
    }
}
