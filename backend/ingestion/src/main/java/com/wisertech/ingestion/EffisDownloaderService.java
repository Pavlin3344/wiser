package com.wisertech.ingestion;

import java.awt.image.Raster;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.resilience.annotation.Retryable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import tools.jackson.databind.ObjectMapper;

@Service
public class EffisDownloaderService {
    private static final Logger log = LoggerFactory.getLogger(EffisDownloaderService.class);

    private static final String WMS_URL = "https://maps.effis.emergency.copernicus.eu/effis";
    private static final String LAYER = "mf010.fwi";
    private static final String EXCHANGE = "weather.exchange";
    private static final String ROUTING_KEY = "weather.ingest";
    private static final int RESOLUTION_KM = 8;

    // The grid is written here and the message carries a reference to it, the same
    // claim-check shape SentinelFetcherService already uses for its GeoTIFF. Inline, the
    // 2772 points serialise to about 223 KB in a single message - fine for RabbitMQ, but
    // 87% of the 256 KB a broker like Azure Service Bus allows, and one lost message
    // costs a whole day of fire weather. The fuel map is likewise externally sourced and
    // lives in this bucket, so the placement has precedent.
    private static final String PRODUCTS_BUCKET = "processed-products";

    // Bulgaria bounding box (west, south, east, north) - same bounds used elsewhere in this
    // project (data/processing/fuel/load_fuel.py) for consistency.
    private static final double WEST = 22.3;
    private static final double SOUTH = 41.2;
    private static final double EAST = 28.7;
    private static final double NORTH = 44.2;
    // ~8km grid over this bbox at this latitude.
    private static final int GRID_WIDTH = 66;
    private static final int GRID_HEIGHT = 42;

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final S3Client s3Client;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    public EffisDownloaderService(
            RabbitTemplate rabbitTemplate,
            ObjectMapper objectMapper,
            S3Client s3Client) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.s3Client = s3Client;
    }

    @Scheduled(fixedRate = 86_400_000) // daily - EFFIS only updates FWI once a day
    // Publishing is the last step, so a retry after a failed fetch cannot double-publish.
    @Retryable(includes = IOException.class, maxRetries = 2, delay = 5000, multiplier = 2, maxDelay = 30_000)
    public int fetchLatest() throws IOException, InterruptedException {
        byte[] tiff = fetchFwiRaster();
        List<Map<String, Object>> points = extractGridPoints(tiff);
        String key = storeGrid(points);
        publishMessage(key, points.size());
        log.info("EFFIS FWI download complete: {} grid points stored at {}/{} and published.",
                points.size(), PRODUCTS_BUCKET, key);
        return points.size();
    }

    private byte[] fetchFwiRaster() throws IOException, InterruptedException {
        String url = ("%s?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=%s&STYLES=&SRS=EPSG:4326"
                + "&BBOX=%s,%s,%s,%s&WIDTH=%d&HEIGHT=%d&FORMAT=image/tiff&TIME=%s")
                .formatted(WMS_URL, LAYER, WEST, SOUTH, EAST, NORTH, GRID_WIDTH, GRID_HEIGHT, LocalDate.now());
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .GET()
                .build();
        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) {
            throw new IOException("EFFIS WMS returned HTTP " + response.statusCode() + ": "
                    + new String(response.body(), StandardCharsets.UTF_8));
        }
        return response.body();
    }

    private List<Map<String, Object>> extractGridPoints(byte[] tiff) throws IOException {
        List<Map<String, Object>> points = new ArrayList<>();
        ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(tiff));
        Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
        ImageReader reader = readers.next();
        reader.setInput(iis);
        Raster raster = reader.readRaster(0, null);

        int width = raster.getWidth();
        int height = raster.getHeight();
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                float fwi = raster.getSampleFloat(x, y, 0);
                if (Float.isNaN(fwi) || fwi < 0) {
                    continue;
                }
                double lon = WEST + (x + 0.5) / width * (EAST - WEST);
                double lat = NORTH - (y + 0.5) / height * (NORTH - SOUTH);

                Map<String, Object> point = new LinkedHashMap<>();
                point.put("lat", lat);
                point.put("lon", lon);
                point.put("fwi", fwi);
                point.put("fwi_class", fwiClass(fwi));
                points.add(point);
            }
        }
        reader.dispose();
        return points;
    }

    // Thresholds per shared/schemas/message-contracts.md section 2.
    private int fwiClass(double fwi) {
        if (fwi < 11.2) {
            return 1;
        }
        if (fwi < 21.3) {
            return 2;
        }
        if (fwi < 38.0) {
            return 3;
        }
        if (fwi < 50.0) {
            return 4;
        }
        if (fwi < 70.0) {
            return 5;
        }
        return 6;
    }

    /** Writes the day's grid to object storage and returns its key. */
    private String storeGrid(List<Map<String, Object>> points) {
        LocalDate today = LocalDate.now();
        String key = "fwi/%s/points.json".formatted(today);

        Map<String, Object> document = new LinkedHashMap<>();
        document.put("date", today.toString());
        document.put("resolution_km", RESOLUTION_KM);
        document.put("points", points);

        byte[] body = objectMapper.writeValueAsString(document).getBytes(StandardCharsets.UTF_8);
        // Same key every day, so a rerun overwrites rather than accumulating - the run is
        // already idempotent downstream thanks to the unique index on fire_weather_index.
        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(PRODUCTS_BUCKET)
                        .key(key)
                        .contentType("application/json")
                        .build(),
                RequestBody.fromBytes(body));
        return key;
    }

    private void publishMessage(String key, int pointCount) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("bucket", PRODUCTS_BUCKET);
        payload.put("path", key);
        payload.put("date", LocalDate.now().toString());
        payload.put("resolution_km", RESOLUTION_KM);
        payload.put("point_count", pointCount);

        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("message_id", UUID.randomUUID().toString());
        envelope.put("timestamp", Instant.now().toString());
        envelope.put("source", "effis-downloader");
        envelope.put("payload", payload);

        String body = objectMapper.writeValueAsString(envelope);

        MessageProperties properties = new MessageProperties();
        properties.setContentType("application/json");
        properties.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
        rabbitTemplate.send(EXCHANGE, ROUTING_KEY, new Message(body.getBytes(StandardCharsets.UTF_8), properties));
    }
}
