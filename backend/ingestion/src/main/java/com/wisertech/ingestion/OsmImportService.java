package com.wisertech.ingestion;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import java.time.Duration;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.resilience.annotation.Retryable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import tools.jackson.databind.ObjectMapper;

@Service
public class OsmImportService {
    private static final Logger log = LoggerFactory.getLogger(OsmImportService.class);
    private static final String OVERPASS_URL = "https://overpass-api.de/api/interpreter";
    private static final String BG_AMENITIES_QUERY = """
            [out:json][timeout:180];
            area["ISO3166-1"="BG"][admin_level=2]->.bg;
            (
              node["amenity"="hospital"](area.bg);
              node["amenity"="school"](area.bg);
              node["amenity"="kindergarten"](area.bg);
            );
            out body;
            """;

    private final CriticalInfrastructureRepository criticalInfrastructureRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    private final boolean scheduledImportEnabled;

    public OsmImportService(
            CriticalInfrastructureRepository criticalInfrastructureRepository,
            ObjectMapper objectMapper,
            @Value("${osm.import.scheduled}") boolean scheduledImportEnabled) {
        this.criticalInfrastructureRepository = criticalInfrastructureRepository;
        this.objectMapper = objectMapper;
        this.scheduledImportEnabled = scheduledImportEnabled;
    }

    // Monthly: Overpass is a shared public service and a country-wide amenity query is
    // expensive, while hospitals and schools rarely move. Off unless explicitly enabled.
    @Scheduled(cron = "${osm.import.cron:0 0 3 1 * *}")
    public void scheduledImport() throws IOException, InterruptedException {
        if (!scheduledImportEnabled) {
            return;
        }
        int imported = importCriticalInfrastructure();
        log.info("Scheduled OSM critical infrastructure import complete: {} records.", imported);
    }

    @Retryable(includes = IOException.class, maxRetries = 2, delay = 5000, multiplier = 2, maxDelay = 30_000)
    public int importCriticalInfrastructure() throws IOException, InterruptedException {
        String body = "data=" + URLEncoder.encode(BG_AMENITIES_QUERY, StandardCharsets.UTF_8);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(OVERPASS_URL))
                .timeout(Duration.ofMinutes(4))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("Overpass API returned HTTP " + response.statusCode() + ": " + response.body());
        }

        OverpassResponse overpassResponse = objectMapper.readValue(response.body(), OverpassResponse.class);

        int imported = 0;
        for (OverpassElement element : overpassResponse.elements()) {
            if (element.lat() == null || element.lon() == null || element.tags() == null) {
                continue;
            }
            if (criticalInfrastructureRepository.existsByOsmId(element.id())) {
                continue;
            }
            String type = element.tags().get("amenity");
            String name = element.tags().get("name");
            Point geom = geometryFactory.createPoint(new Coordinate(element.lon(), element.lat()));
            criticalInfrastructureRepository.save(new CriticalInfrastructure(element.id(), name, type, geom));
            imported++;
        }
        return imported;
    }
}
