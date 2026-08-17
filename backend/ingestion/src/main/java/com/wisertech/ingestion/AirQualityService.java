package com.wisertech.ingestion;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.StringJoiner;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.resilience.annotation.Retryable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Air quality during a fire is one of the things operators are asked to watch, so
 * pollutant readings are sampled across Bulgaria and stored as a time series rather
 * than only shown live - a reading is most useful compared against the hours before it.
 *
 * Open-Meteo's air quality API needs no key and accepts many coordinates per call,
 * so the whole grid is one request per run.
 */
@Service
public class AirQualityService {
    private static final Logger log = LoggerFactory.getLogger(AirQualityService.class);

    private static final String SOURCE = "open-meteo-cams";
    private static final String API_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

    // Bulgaria bounding box, same bounds used by the EFFIS downloader.
    private static final double WEST = 22.3;
    private static final double SOUTH = 41.2;
    private static final double EAST = 28.7;
    private static final double NORTH = 44.2;
    // A coarse grid: enough to show regional contrast without a large request.
    private static final int GRID_COLS = 5;
    private static final int GRID_ROWS = 4;

    private static final String INSERT_SQL = """
        INSERT INTO air_quality (time, lat, lon, source, no2, pm25, pm10, co)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (time, lat, lon, source) DO NOTHING
        """;

    private final JdbcTemplate timescaleJdbcTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    public AirQualityService(
            @Qualifier("timescaleJdbcTemplate") JdbcTemplate timescaleJdbcTemplate,
            ObjectMapper objectMapper) {
        this.timescaleJdbcTemplate = timescaleJdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Scheduled(fixedRate = 3_600_000) // hourly - the upstream model publishes hourly
    @Retryable(includes = IOException.class, maxRetries = 2, delay = 5000, multiplier = 2, maxDelay = 30_000)
    public int fetchLatest() throws IOException, InterruptedException {
        List<double[]> points = grid();
        JsonNode response = objectMapper.readTree(fetch(points));

        // A single coordinate returns an object, several return an array.
        List<JsonNode> locations = new ArrayList<>();
        if (response.isArray()) {
            response.forEach(locations::add);
        } else {
            locations.add(response);
        }

        int stored = 0;
        for (JsonNode location : locations) {
            JsonNode current = location.get("current");
            if (current == null) {
                continue;
            }
            Instant time = LocalDateTime.parse(current.get("time").asString()).toInstant(ZoneOffset.UTC);
            stored += timescaleJdbcTemplate.update(INSERT_SQL,
                    java.sql.Timestamp.from(time),
                    location.get("latitude").asDouble(),
                    location.get("longitude").asDouble(),
                    SOURCE,
                    value(current, "nitrogen_dioxide"),
                    value(current, "pm2_5"),
                    value(current, "pm10"),
                    value(current, "carbon_monoxide"));
        }

        log.info("Air quality run complete: {} new readings stored across {} grid points.", stored, points.size());
        return stored;
    }

    private String fetch(List<double[]> points) throws IOException, InterruptedException {
        StringJoiner lats = new StringJoiner(",");
        StringJoiner lngs = new StringJoiner(",");
        for (double[] point : points) {
            lats.add(String.valueOf(point[0]));
            lngs.add(String.valueOf(point[1]));
        }

        String url = "%s?latitude=%s&longitude=%s&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide&timezone=UTC"
                .formatted(API_URL, lats, lngs);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("Air quality API returned HTTP " + response.statusCode() + ": " + response.body());
        }
        return response.body();
    }

    static List<double[]> grid() {
        List<double[]> points = new ArrayList<>();
        for (int row = 0; row < GRID_ROWS; row++) {
            for (int col = 0; col < GRID_COLS; col++) {
                double lat = SOUTH + (NORTH - SOUTH) * (row + 0.5) / GRID_ROWS;
                double lon = WEST + (EAST - WEST) * (col + 0.5) / GRID_COLS;
                points.add(new double[] { round(lat), round(lon) });
            }
        }
        return points;
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static Double value(JsonNode current, String field) {
        JsonNode node = current.get(field);
        return node == null || node.isNull() ? null : node.asDouble();
    }
}
