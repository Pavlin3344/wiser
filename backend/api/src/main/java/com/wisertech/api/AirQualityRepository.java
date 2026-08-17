package com.wisertech.api;

import java.time.Instant;
import java.util.List;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AirQualityRepository {

    /**
     * The most recent reading per grid point. DISTINCT ON is the cheap way to do this
     * in Postgres, and it keeps points that stopped reporting from disappearing when
     * one location lags behind the others.
     */
    private static final String LATEST_SQL = """
        SELECT DISTINCT ON (lat, lon) time, lat, lon, source, no2, pm25, pm10, co
        FROM air_quality
        WHERE time > NOW() - INTERVAL '24 hours'
        ORDER BY lat, lon, time DESC
        """;

    private static final String HISTORY_SQL = """
        SELECT time_bucket('1 hour', time) AS bucket,
               AVG(no2) AS no2, AVG(pm25) AS pm25, AVG(pm10) AS pm10, AVG(co) AS co
        FROM air_quality
        WHERE time > NOW() - make_interval(hours => ?)
        GROUP BY bucket
        ORDER BY bucket
        """;

    private final JdbcTemplate timescaleJdbcTemplate;

    public AirQualityRepository(@Qualifier("timescaleJdbcTemplate") JdbcTemplate timescaleJdbcTemplate) {
        this.timescaleJdbcTemplate = timescaleJdbcTemplate;
    }

    public List<AirQualityReading> findLatest() {
        return timescaleJdbcTemplate.query(LATEST_SQL, (rs, rowNum) -> new AirQualityReading(
                rs.getTimestamp("time").toInstant(),
                rs.getDouble("lat"),
                rs.getDouble("lon"),
                rs.getString("source"),
                (Double) rs.getObject("no2"),
                (Double) rs.getObject("pm25"),
                (Double) rs.getObject("pm10"),
                (Double) rs.getObject("co")));
    }

    public List<AirQualityAverage> findCountryAverages(int hours) {
        return timescaleJdbcTemplate.query(HISTORY_SQL, (rs, rowNum) -> new AirQualityAverage(
                rs.getTimestamp("bucket").toInstant(),
                (Double) rs.getObject("no2"),
                (Double) rs.getObject("pm25"),
                (Double) rs.getObject("pm10"),
                (Double) rs.getObject("co")), hours);
    }

    public record AirQualityReading(
            Instant time, double lat, double lon, String source,
            Double no2, Double pm25, Double pm10, Double co) {
    }

    public record AirQualityAverage(Instant time, Double no2, Double pm25, Double pm10, Double co) {
    }
}
