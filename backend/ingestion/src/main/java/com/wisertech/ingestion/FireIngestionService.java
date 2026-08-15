package com.wisertech.ingestion;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
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
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import tools.jackson.databind.ObjectMapper;

@Service
public class FireIngestionService {
    private static final Logger log = LoggerFactory.getLogger(FireIngestionService.class);

    private static final String EXCHANGE = "fire.exchange";
    private static final String ROUTING_KEY = "fire.detections";

    private final FireDetectionProvider fireDetectionProvider;
    private final ActiveFireRepository activeFireRepository;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final Counter importedCounter;

    public FireIngestionService(
            FireDetectionProvider fireDetectionProvider,
            ActiveFireRepository activeFireRepository,
            RabbitTemplate rabbitTemplate,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry) {
        this.fireDetectionProvider = fireDetectionProvider;
        this.activeFireRepository = activeFireRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.importedCounter = Counter.builder("wiser.ingestion.detections.imported")
                .description("Fire detections written to the database since startup")
                .register(meterRegistry);
    }

    @Scheduled(fixedRate = 3_600_000)
    public int ingestLatest() throws IOException, InterruptedException {
        List<Long> importedIds = new ArrayList<>();
        for (ActiveFire detection : fireDetectionProvider.fetchLatest()) {
            boolean duplicate = activeFireRepository.existsDuplicate(
                    detection.getSource(), detection.getDetectedAt(), detection.getGeom());
            if (duplicate) {
                continue;
            }
            importedIds.add(activeFireRepository.save(detection).getId());
        }
        importedCounter.increment(importedIds.size());
        log.info("Fire ingestion run complete: {} new detections imported.", importedIds.size());
        // Only announce actual changes - the API service turns this into an SSE push,
        // and an empty run is not news for connected dashboards.
        if (!importedIds.isEmpty()) {
            publishDetections(importedIds);
        }
        return importedIds.size();
    }

    private void publishDetections(List<Long> importedIds) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("count", importedIds.size());
        payload.put("fire_ids", importedIds);

        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("message_id", UUID.randomUUID().toString());
        envelope.put("timestamp", Instant.now().toString());
        envelope.put("source", "fire-ingestion");
        envelope.put("payload", payload);

        MessageProperties properties = new MessageProperties();
        properties.setContentType("application/json");
        properties.setDeliveryMode(MessageDeliveryMode.PERSISTENT);

        String body = objectMapper.writeValueAsString(envelope);
        rabbitTemplate.send(EXCHANGE, ROUTING_KEY, new Message(body.getBytes(StandardCharsets.UTF_8), properties));
    }
}
