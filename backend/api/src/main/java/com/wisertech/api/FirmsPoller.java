package com.wisertech.api;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Pulls active fire detections from NASA FIRMS (VIIRS_SNPP_NRT, near-real-time)
 * for Bulgaria and replaces our copy of them in active_fires. This is a
 * pragmatic shortcut: the "real" design (docs/team/connection-guide.md, Phase 2)
 * routes this through a RabbitMQ fire.detections worker that doesn't exist yet -
 * this class calls FIRMS directly instead, to get real data flowing today.
 *
 * Needs a free MAP_KEY from https://firms.modaps.eosdis.nasa.gov/api/area/
 * set as FIRMS_MAP_KEY in .env. Without it, this just logs a warning and
 * does nothing - the app still boots and serves whatever's already in the DB.
 */
@Component
public class FirmsPoller {

    private static final Logger log = LoggerFactory.getLogger(FirmsPoller.class);
    private static final String SOURCE = "FIRMS-VIIRS_SNPP_NRT";
    // west,south,east,north - covers Bulgaria with a small margin.
    private static final String BULGARIA_BBOX = "22.0,41.0,29.0,44.5";

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    @Value("${FIRMS_MAP_KEY:}")
    private String mapKey;

    public FirmsPoller(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Scheduled(initialDelay = 0, fixedRate = 30, timeUnit = TimeUnit.MINUTES)
    public void pollActiveFires() {
        if (mapKey == null || mapKey.isBlank()) {
            log.warn("FIRMS_MAP_KEY not set - skipping active fire poll. "
                + "Get a free key at https://firms.modaps.eosdis.nasa.gov/api/area/ and add it to .env");
            return;
        }

        String url = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/%s/VIIRS_SNPP_NRT/%s/1"
            .formatted(mapKey, BULGARIA_BBOX);

        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .GET()
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("FIRMS API returned HTTP {} - keeping previous data", response.statusCode());
                return;
            }

            applyFires(response.body());
        } catch (Exception e) {
            log.warn("FIRMS poll failed, keeping previous data: {}", e.getMessage());
        }
    }

    @Transactional
    void applyFires(String csvBody) {
        List<String> lines = csvBody.lines().toList();
        jdbcTemplate.update("DELETE FROM active_fires WHERE source = ?", SOURCE);

        if (lines.size() < 2) {
            log.info("FIRMS: no active fires in Bulgaria right now");
            return;
        }

        String[] header = lines.get(0).split(",");
        int latIdx = indexOf(header, "latitude");
        int lonIdx = indexOf(header, "longitude");
        int dateIdx = indexOf(header, "acq_date");
        int timeIdx = indexOf(header, "acq_time");
        int confIdx = indexOf(header, "confidence");
        int frpIdx = indexOf(header, "frp");
        int satIdx = indexOf(header, "satellite");

        int inserted = 0;
        for (int i = 1; i < lines.size(); i++) {
            if (lines.get(i).isBlank()) continue;
            String[] cols = lines.get(i).split(",");

            double lat = Double.parseDouble(cols[latIdx]);
            double lon = Double.parseDouble(cols[lonIdx]);
            OffsetDateTime detectedAt = parseAcquisition(cols[dateIdx], cols[timeIdx]);
            int confidence = confidenceToNumber(cols[confIdx]);
            double frp = frpIdx >= 0 && !cols[frpIdx].isBlank() ? Double.parseDouble(cols[frpIdx]) : 0;

            ObjectNode properties = objectMapper.createObjectNode();
            properties.put("satellite", satIdx >= 0 ? cols[satIdx] : "unknown");
            properties.put("raw_confidence", cols[confIdx]);

            jdbcTemplate.update("""
                INSERT INTO active_fires (source, detected_at, confidence, frp, geom, properties)
                VALUES (?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?::jsonb)
                """,
                SOURCE, detectedAt, confidence, frp, lon, lat, properties.toString());
            inserted++;
        }

        log.info("FIRMS poll: refreshed {} active fire detections for Bulgaria", inserted);
    }

    private static int indexOf(String[] header, String name) {
        for (int i = 0; i < header.length; i++) {
            if (header[i].trim().equalsIgnoreCase(name)) return i;
        }
        return -1;
    }

    // VIIRS confidence comes back as text (l/n/h), not the numeric 0-100 our
    // schema expects - bucketed to roughly match FIRMS' own documented meaning.
    // Placeholder, not validated against real detection accuracy stats.
    private static int confidenceToNumber(String raw) {
        return switch (raw.trim().toLowerCase()) {
            case "l" -> 30;
            case "n" -> 60;
            case "h" -> 90;
            default -> {
                try {
                    yield Integer.parseInt(raw.trim());
                } catch (NumberFormatException e) {
                    yield 50;
                }
            }
        };
    }

    private static OffsetDateTime parseAcquisition(String date, String time) {
        // acq_date looks like 2026-07-26, acq_time is HHmm UTC (e.g. "512" for 05:12).
        LocalDate d = LocalDate.parse(date.trim());
        String t = time.trim();
        while (t.length() < 4) t = "0" + t;
        LocalTime lt = LocalTime.parse(t, DateTimeFormatter.ofPattern("HHmm"));
        return OffsetDateTime.of(d, lt, ZoneOffset.UTC);
    }
}
