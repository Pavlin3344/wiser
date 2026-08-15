package com.wisertech.api;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class FireRepository {

    // PostGIS stores geom as a binary type Java can't read directly, so we ask
    // Postgres to convert it to GeoJSON text (ST_AsGeoJSON) before it leaves the DB.
    // LIMIT is a safety cap, not real pagination - fine for now, revisit if the
    // table grows large.
    private static final String ACTIVE_FIRES_SQL = """
        SELECT id, source, detected_at, confidence, frp,
               ST_AsGeoJSON(geom) AS geom_json,
               properties
        FROM active_fires
        ORDER BY detected_at DESC
        LIMIT 5000
        """;

    // Days with no detections still have to appear in the chart, otherwise a quiet
    // Tuesday silently vanishes and the week looks shorter than it was.
    private static final String DAILY_COUNTS_SQL = """
        SELECT d.day::date AS day, COUNT(f.id) AS fire_count
        FROM generate_series(
                 (CURRENT_DATE - make_interval(days => ? - 1)),
                 CURRENT_DATE,
                 '1 day'
             ) AS d(day)
        LEFT JOIN active_fires f ON f.detected_at >= d.day AND f.detected_at < d.day + INTERVAL '1 day'
        GROUP BY d.day
        ORDER BY d.day
        """;

    private final JdbcTemplate jdbcTemplate;

    public FireRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<DailyFireCount> findDailyCounts(int days) {
        return jdbcTemplate.query(DAILY_COUNTS_SQL, (rs, rowNum) -> new DailyFireCount(
                rs.getDate("day").toLocalDate(),
                rs.getInt("fire_count")), days);
    }

    public record DailyFireCount(java.time.LocalDate day, int count) {
    }

    public List<ActiveFireRow> findActiveFires() {
        return jdbcTemplate.query(ACTIVE_FIRES_SQL, (rs, rowNum) -> new ActiveFireRow(
            rs.getLong("id"),
            rs.getString("source"),
            rs.getTimestamp("detected_at").toInstant(),
            rs.getObject("confidence") != null ? rs.getInt("confidence") : null,
            rs.getObject("frp") != null ? rs.getDouble("frp") : null,
            rs.getString("geom_json"),
            rs.getString("properties")
        ));
    }
}
