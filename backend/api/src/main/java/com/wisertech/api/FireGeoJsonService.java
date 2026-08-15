package com.wisertech.api;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Builds the GeoJSON FeatureCollection shape that frontend/src/services/fireService.ts
 * expects. Shared by the REST endpoint and the SSE stream so both emit identical payloads.
 */
@Service
public class FireGeoJsonService {

    private final FireRepository fireRepository;
    private final ObjectMapper objectMapper;

    public FireGeoJsonService(FireRepository fireRepository, ObjectMapper objectMapper) {
        this.fireRepository = fireRepository;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> activeFiresAsFeatureCollection() {
        List<Object> features = new ArrayList<>();

        for (ActiveFireRow row : fireRepository.findActiveFires()) {
            ObjectNode properties = readObjectOrEmpty(row.propertiesJson());
            properties.put("title", row.source() + " detection #" + row.id());
            properties.put("intensity", intensityFor(row.frp()));
            properties.put("date", row.detectedAt().toString());

            JsonNode geometry = objectMapper.readTree(row.geometryJson());

            features.add(Map.of(
                    "type", "Feature",
                    "geometry", geometry,
                    "properties", properties));
        }

        return Map.of(
                "type", "FeatureCollection",
                "features", features);
    }

    private ObjectNode readObjectOrEmpty(String json) {
        if (json == null) {
            return objectMapper.createObjectNode();
        }
        JsonNode node = objectMapper.readTree(json);
        return node.isObject() ? (ObjectNode) node : objectMapper.createObjectNode();
    }

    // Placeholder thresholds - not validated against real fire-science data.
    // Revisit with a domain expert before relying on this for real alerting.
    private String intensityFor(Double frp) {
        if (frp == null) return "low";
        if (frp < 10) return "low";
        if (frp < 50) return "moderate";
        if (frp < 150) return "high";
        return "critical";
    }
}
