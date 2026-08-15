package com.wisertech.api;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/evacuation")
public class EvacuationController {

    private final EvacuationRepository evacuationRepository;
    private final ObjectMapper objectMapper;

    public EvacuationController(EvacuationRepository evacuationRepository, ObjectMapper objectMapper) {
        this.evacuationRepository = evacuationRepository;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/route")
    public ResponseEntity<Map<String, Object>> route(@Valid @RequestBody EvacuationRouteRequest request) {
        if (!evacuationRepository.hasRoutingTopology()) {
            throw new RoutingTopologyMissingException(
                    "Road routing topology is not imported. Run the osm2pgrouting import documented in "
                            + "db/postgres/scripts/README.md before requesting evacuation routes.");
        }

        Integer start = evacuationRepository.findNearestVertex(request.fromLng(), request.fromLat()).orElse(null);
        Integer end = evacuationRepository.findNearestVertex(request.toLng(), request.toLat()).orElse(null);
        if (start == null || end == null) {
            return ResponseEntity.notFound().build();
        }

        return evacuationRepository.findShortestPath(start, end)
                .map(row -> ResponseEntity.ok(Map.<String, Object>of(
                        "type", "Feature",
                        "geometry", objectMapper.readTree(row.geometryJson()),
                        "properties", Map.of(
                                "totalCost", row.totalCost(),
                                "segments", row.segments()))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
