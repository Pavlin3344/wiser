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
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import tools.jackson.databind.ObjectMapper;

@Service
public class EffisDownloaderService {
    private static final Logger log = LoggerFactory.getLogger(EffisDownloaderService.class);

    private static final String WMS_URL = "https://maps.effis.emergency.copernicus.eu/effis";
    private static final String LAYER = "mf010.fwi";
    private static final String EXCHANGE = "weather.exchange";
    private static final String ROUTING_KEY = "weather.ingest";
    private static final int RESOLUTION_KM = 8;

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
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    public EffisDownloaderService(RabbitTemplate rabbitTemplate, ObjectMapper objectMapper) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
    }

    @Scheduled(fixedRate = 86_400_000) // daily - EFFIS only updates FWI once a day
    public int fetchLatest() throws IOException, InterruptedException {
        byte[] tiff = fetchFwiRaster();
        List<Map<String, Object>> points = extractGridPoints(tiff);
        publishMessage(points);
        log.info("EFFIS FWI download complete: {} grid points published.", points.size());
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

    private void publishMessage(List<Map<String, Object>> points) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("date", LocalDate.now().toString());
        payload.put("resolution_km", RESOLUTION_KM);
        payload.put("points", points);

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
