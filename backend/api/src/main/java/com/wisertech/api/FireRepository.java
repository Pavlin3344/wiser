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

    private final JdbcTemplate jdbcTemplate;

    public FireRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
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
