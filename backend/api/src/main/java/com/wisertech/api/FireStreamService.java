package com.wisertech.api;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

/**
 * Pushes active-fire updates to connected dashboards. Ingestion publishes to
 * fire.exchange after writing a detection; this fans that out to browsers so the
 * map updates on arrival instead of on a five-minute poll.
 */
@Service
public class FireStreamService {
    private static final Logger log = LoggerFactory.getLogger(FireStreamService.class);
    private static final long NO_TIMEOUT = 0L;

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final FireGeoJsonService fireGeoJsonService;

    public FireStreamService(FireGeoJsonService fireGeoJsonService, MeterRegistry meterRegistry) {
        this.fireGeoJsonService = fireGeoJsonService;
        Gauge.builder("wiser.sse.subscribers", emitters, List::size)
                .description("Dashboards currently connected to the live fire stream")
                .register(meterRegistry);
    }

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(NO_TIMEOUT);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));

        try {
            emitter.send(SseEmitter.event().name("fires").data(fireGeoJsonService.activeFiresAsFeatureCollection()));
        } catch (IOException e) {
            emitters.remove(emitter);
            emitter.completeWithError(e);
        }
        return emitter;
    }

    @RabbitListener(queues = "fire.detections")
    public void onFireDetections(String message) {
        log.debug("Fire detection event received, broadcasting to {} subscriber(s).", emitters.size());
        broadcast();
    }

    public void broadcast() {
        if (emitters.isEmpty()) {
            return;
        }
        Object payload = fireGeoJsonService.activeFiresAsFeatureCollection();
        for (SseEmitter emitter : emitters) {
            send(emitter, SseEmitter.event().name("fires").data(payload));
        }
    }

    // Without periodic traffic, nginx and intermediate proxies close an idle SSE
    // connection; the comment frame keeps it alive without touching the database.
    @Scheduled(fixedRate = 30_000)
    public void heartbeat() {
        for (SseEmitter emitter : emitters) {
            send(emitter, SseEmitter.event().comment("keep-alive"));
        }
    }

    public int subscriberCount() {
        return emitters.size();
    }

    private void send(SseEmitter emitter, SseEmitter.SseEventBuilder event) {
        try {
            emitter.send(event);
        } catch (Exception e) {
            // A disconnected browser is normal, not an error worth alerting on.
            emitters.remove(emitter);
            emitter.completeWithError(e);
        }
    }
}
