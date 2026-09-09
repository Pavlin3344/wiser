package com.wisertech.api;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
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

    // Every edge query below is bounded to a box around the points being routed
    // between. Without it pgr_dijkstra loads the whole country - 775 624 edges after the
    // Bulgaria import - for a route across one town, and the fire check ran a geography
    // distance for every one of those edges against every detection ever stored. Measured
    // on the Azure database: over 150 seconds, every request, before the UI gave up. The
    // box is the GIST index's job; it turns that into a few thousand edges.
    //
    // The numbers are formatted into the SQL text rather than bound, because pgr_dijkstra
    // takes its edge query as a string and a bound parameter cannot reach inside it. They
    // are doubles and ints from code, never user text, so they cannot carry SQL.
    private static final String ROUTE_SQL = """
        SELECT ST_AsGeoJSON(ST_LineMerge(ST_Collect(r.geom ORDER BY d.seq))) AS geom_json,
               SUM(d.cost) AS total_cost,
               COUNT(*) AS segments
        FROM pgr_dijkstra(
                 'SELECT id, source, target, cost, reverse_cost FROM roads
                   WHERE passable = true AND source IS NOT NULL AND target IS NOT NULL
                     AND geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)',
                 ?, ?, directed := true
             ) d
        JOIN roads r ON r.id = d.edge
        """;

    /**
     * Assembly points to evacuate towards: known critical infrastructure that is not
     * itself inside the fire buffer. Sending people to a school that is about to burn
     * would be worse than sending them nowhere.
     *
     * <p>Only detections inside the active window count as a fire here, the same window
     * {@code FireRepository} uses for the map. Nothing ever deletes a detection, so without
     * it a school beside a fire that went out three weeks ago stayed off the list forever.
     */
    private static final String SAFE_DESTINATIONS_SQL = """
        WITH origin AS (SELECT ST_SetSRID(ST_MakePoint(?, ?), 4326) AS p),
        safe AS (
            SELECT ci.id, ci.name, ci.type, ci.geom
            FROM critical_infrastructure ci, origin
            WHERE NOT EXISTS (
                SELECT 1 FROM active_fires f
                WHERE f.detected_at > NOW() - make_interval(hours => ?)
                  AND f.geom && ST_Expand(ci.geom, ?)
                  AND ST_DWithin(ci.geom::geography, f.geom::geography, ?)
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
     *
     * <p>Three things keep the fire check cheap enough to run per request. The edge set is
     * the bounding box, not the country. Only detections inside the active window are
     * fires - the previous version compared against every detection ever ingested, so
     * roads beside long-extinguished fires stayed cut for good and the query did the
     * work of all of them. And the cheap box test ({@code &&}, on the GIST index) runs
     * before the geography distance, so the distance is only computed for the handful of
     * detections anywhere near the road. Measured against the same network and 425
     * detections: 6.2 s and no routes before, 177 ms and every route after.
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
                     AND r.geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
                     AND NOT EXISTS (
                           SELECT 1 FROM active_fires f
                            WHERE f.detected_at > NOW() - make_interval(hours => %d)
                              AND f.geom && ST_Expand(r.geom, %s)
                              AND ST_DWithin(r.geom::geography, f.geom::geography, %s)
                     )',
                 ?, ?, directed := true
             ) d
        JOIN roads r ON r.id = d.edge
        GROUP BY d.end_vid
        """;

    private final JdbcTemplate jdbcTemplate;
    private final int activeWindowHours;

    public EvacuationRepository(
            JdbcTemplate jdbcTemplate,
            @Value("${wiser.active-fire-window-hours:24}") int activeWindowHours) {
        this.jdbcTemplate = jdbcTemplate;
        this.activeWindowHours = activeWindowHours;
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

    public Optional<RouteRow> findShortestPath(int startVertex, int endVertex, Bbox bbox) {
        String sql = String.format(Locale.ROOT, ROUTE_SQL,
                num(bbox.minLng()), num(bbox.minLat()), num(bbox.maxLng()), num(bbox.maxLat()));
        RouteRow row = jdbcTemplate.query(sql, rs -> {
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
                lng, lat, activeWindowHours, prefilterDegrees(fireBufferMeters), fireBufferMeters, limit);
    }

    public List<EvacuationRoute> findRoutesAvoidingFires(
            int startVertex, List<Integer> endVertices, double fireBufferMeters, Bbox bbox) {
        if (endVertices.isEmpty()) {
            return List.of();
        }
        String sql = String.format(Locale.ROOT, ROUTES_AVOIDING_FIRES_SQL,
                num(bbox.minLng()), num(bbox.minLat()), num(bbox.maxLng()), num(bbox.maxLat()),
                activeWindowHours, num(prefilterDegrees(fireBufferMeters)), num(fireBufferMeters));
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

    // Locale.ROOT, and a fixed-point format: a Bulgarian default locale would write the
    // decimal comma into the SQL, and %s on a small double can produce 1.0E-4, which
    // Postgres reads but which is not what anyone debugging the query expects to see.
    private static String num(double value) {
        return String.format(Locale.ROOT, "%.6f", value);
    }

    // The box test that runs before the geography distance. A degree of latitude is about
    // 111 km; a degree of longitude at Bulgaria's latitude is less, so the margin is
    // generous on purpose - it only decides which detections get the exact check, never
    // the result of it.
    static double prefilterDegrees(double bufferMeters) {
        return bufferMeters / 111_000.0 * 1.5;
    }

    /**
     * The area a route is allowed to use. Built from every point involved - where the
     * caller stands and each assembly point - then widened so a detour has room: by a
     * tenth of a degree (about 11 km) at least, or by half the box's longer side when the
     * points are far apart, whichever is more. A route that would have to leave the box
     * is not found; for evacuation towards the nearest few assembly points that is the
     * right trade against loading the whole country per request.
     */
    public record Bbox(double minLng, double minLat, double maxLng, double maxLat) {

        static final double MIN_MARGIN_DEGREES = 0.1;

        /** Coordinates as alternating lng, lat pairs. */
        public static Bbox around(double... lngLat) {
            if (lngLat.length < 2 || lngLat.length % 2 != 0) {
                throw new IllegalArgumentException("expected lng/lat pairs, got " + lngLat.length + " values");
            }
            double minLng = Double.MAX_VALUE, minLat = Double.MAX_VALUE;
            double maxLng = -Double.MAX_VALUE, maxLat = -Double.MAX_VALUE;
            for (int i = 0; i < lngLat.length; i += 2) {
                minLng = Math.min(minLng, lngLat[i]);
                maxLng = Math.max(maxLng, lngLat[i]);
                minLat = Math.min(minLat, lngLat[i + 1]);
                maxLat = Math.max(maxLat, lngLat[i + 1]);
            }
            double margin = Math.max(MIN_MARGIN_DEGREES, 0.5 * Math.max(maxLng - minLng, maxLat - minLat));
            return new Bbox(minLng - margin, minLat - margin, maxLng + margin, maxLat + margin);
        }
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
