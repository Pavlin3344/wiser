package com.wisertech.ingestion;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.resilience.annotation.Retryable;
import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

@Component
public class FirmsFireDetectionProvider implements FireDetectionProvider {
    private static final Logger log = LoggerFactory.getLogger(FirmsFireDetectionProvider.class);
    private static final String PLACEHOLDER_KEY = "REPLACE_ME_REGISTER_AT_FIRMS";
    private static final String SOURCE = "MODIS_NRT";
    private static final String DAY_RANGE = "1";

    private final String mapKey;
    private final String area;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    public FirmsFireDetectionProvider(
            @Value("${firms.map-key}") String mapKey,
            @Value("${firms.area}") String area,
            MeterRegistry meterRegistry) {
        this.mapKey = mapKey;
        this.area = area;
        // Lets Grafana alert on "ingestion is configured but blind" rather than waiting
        // for someone to notice the map has been empty for a week.
        Gauge.builder("wiser.ingestion.firms.configured", this, p -> p.isConfigured() ? 1 : 0)
                .description("1 when a real FIRMS API key is configured, 0 when detections cannot be fetched")
                .register(meterRegistry);
    }

    boolean isConfigured() {
        return !PLACEHOLDER_KEY.equals(mapKey);
    }

    @Override
    @Retryable(includes = IOException.class, maxRetries = 2, delay = 5000, multiplier = 2, maxDelay = 30_000)
    public List<ActiveFire> fetchLatest() throws IOException, InterruptedException {
        if (PLACEHOLDER_KEY.equals(mapKey)) {
            // Error, not warning: in this state the system silently detects no fires at all,
            // which is indistinguishable from "no fires burning" unless it is loud.
            log.error("FIRMS_MAP_KEY not set - fire ingestion is disabled and no detections will be imported. "
                    + "Register at https://firms.modaps.eosdis.nasa.gov/api/area/ and set FIRMS_MAP_KEY.");
            return List.of();
        }

        String url = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/%s/%s/%s/%s"
                .formatted(mapKey, SOURCE, area, DAY_RANGE);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("FIRMS API returned HTTP " + response.statusCode() + ": " + response.body());
        }

        return parseCsv(response.body());
    }

    private List<ActiveFire> parseCsv(String csv) {
        List<ActiveFire> detections = new ArrayList<>();
        String[] lines = csv.split("\n");
        // line 0 is the header: latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].strip();
            if (line.isEmpty()) {
                continue;
            }
            String[] columns = line.split(",");
            double latitude = Double.parseDouble(columns[0]);
            double longitude = Double.parseDouble(columns[1]);
            String acqDate = columns[5];
            String acqTime = columns[6];
            short confidence = Short.parseShort(columns[9]);
            double frp = Double.parseDouble(columns[12]);

            Instant detectedAt = parseAcquisitionInstant(acqDate, acqTime);
            Point geom = geometryFactory.createPoint(new Coordinate(longitude, latitude));
            detections.add(new ActiveFire(SOURCE, detectedAt, confidence, frp, geom));
        }
        return detections;
    }

    private Instant parseAcquisitionInstant(String acqDate, String acqTime) {
        String paddedTime = "%04d".formatted(Integer.parseInt(acqTime));
        String hour = paddedTime.substring(0, 2);
        String minute = paddedTime.substring(2, 4);
        return Instant.parse("%sT%s:%s:00Z".formatted(acqDate, hour, minute));
    }
}
