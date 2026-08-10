package com.wisertech.ingestion;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class SentinelFetcherService {
    private static final Logger log = LoggerFactory.getLogger(SentinelFetcherService.class);

    private static final String TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
    private static final String PROCESS_URL = "https://sh.dataspace.copernicus.eu/process/v1";
    private static final String BUCKET = "satellite-imagery";
    private static final String EXCHANGE = "satellite.exchange";
    private static final String ROUTING_KEY = "satellite.ingest";

    // Matches the Data Engineer's own test fixture (data/processing/ndvi/mock_publisher.py)
    // so the real fetcher's output lands exactly where their worker has already been tested against.
    private static final String TILE = "T34TGN";
    private static final double[] BBOX = {25.0, 42.4, 25.5, 42.8};

    private static final String EVALSCRIPT = """
            //VERSION=3
            function setup() {
              return {
                input: ['B04', 'B08'],
                output: [{ id: 'default', bands: 2, sampleType: 'FLOAT32' }]
              }
            }
            function evaluatePixel(sample) {
              return [sample.B04, sample.B08]
            }
            """;

    private final String clientId;
    private final String clientSecret;
    private final S3Client s3Client;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    public SentinelFetcherService(
            @Value("${copernicus.client-id}") String clientId,
            @Value("${copernicus.client-secret}") String clientSecret,
            S3Client s3Client,
            RabbitTemplate rabbitTemplate,
            ObjectMapper objectMapper) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.s3Client = s3Client;
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
    }

    @Scheduled(fixedRate = 259_200_000) // ~3 days, matches the contract's "new overpass" rhythm
    public void fetchLatest() throws IOException, InterruptedException {
        String token = fetchAccessToken();
        byte[] tiff = fetchGeoTiff(token);

        String date = Instant.now().toString().substring(0, 10);
        String key = "sentinel2/%s/%s.tif".formatted(date, TILE);

        s3Client.putObject(
                PutObjectRequest.builder().bucket(BUCKET).key(key).build(),
                RequestBody.fromBytes(tiff));

        publishMessage(date, key);
        log.info("Sentinel-2 scene uploaded to {}/{} ({} bytes)", BUCKET, key, tiff.length);
    }

    private String fetchAccessToken() throws IOException, InterruptedException {
        String body = "grant_type=client_credentials&client_id=%s&client_secret=%s"
                .formatted(clientId, clientSecret);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("Copernicus token request returned HTTP " + response.statusCode() + ": " + response.body());
        }
        JsonNode json = objectMapper.readTree(response.body());
        return json.get("access_token").asString();
    }

    private byte[] fetchGeoTiff(String token) throws IOException, InterruptedException {
        Instant now = Instant.now();
        Instant from = now.minus(3, ChronoUnit.DAYS);

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("input", Map.of(
                "bounds", Map.of("bbox", BBOX),
                "data", List.of(Map.of(
                        "type", "sentinel-2-l2a",
                        "dataFilter", Map.of(
                                "timeRange", Map.of("from", from.toString(), "to", now.toString()),
                                "maxCloudCoverage", 30)))));
        requestBody.put("output", Map.of(
                "width", 512,
                "height", 512,
                "responses", List.of(Map.of(
                        "identifier", "default",
                        "format", Map.of("type", "image/tiff")))));
        requestBody.put("evalscript", EVALSCRIPT);

        String json = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(PROCESS_URL))
                .timeout(Duration.ofSeconds(60))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) {
            throw new IOException("Copernicus Process API returned HTTP " + response.statusCode() + ": "
                    + new String(response.body(), StandardCharsets.UTF_8));
        }
        return response.body();
    }

    private void publishMessage(String date, String key) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("bucket", BUCKET);
        payload.put("path", key);
        payload.put("tile", TILE);
        payload.put("date", date);
        payload.put("bands", List.of("B04", "B08"));
        payload.put("bbox", BBOX);
        payload.put("crs", "EPSG:4326");

        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("message_id", UUID.randomUUID().toString());
        envelope.put("timestamp", Instant.now().toString());
        envelope.put("source", "sentinel-fetcher");
        envelope.put("payload", payload);

        String body = objectMapper.writeValueAsString(envelope);

        MessageProperties properties = new MessageProperties();
        properties.setContentType("application/json");
        properties.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
        rabbitTemplate.send(EXCHANGE, ROUTING_KEY, new Message(body.getBytes(StandardCharsets.UTF_8), properties));
    }
}
