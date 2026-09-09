package com.wisertech.api;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/evacuation")
public class EvacuationController {

    private final EvacuationRepository evacuationRepository;
    private final ObjectMapper objectMapper;
    private final double fireBufferMeters;
    private final int maxDestinations;

    public EvacuationController(
            EvacuationRepository evacuationRepository,
            ObjectMapper objectMapper,
            @Value("${evacuation.fire-buffer-meters}") double fireBufferMeters,
            @Value("${evacuation.max-destinations}") int maxDestinations) {
        this.evacuationRepository = evacuationRepository;
        this.objectMapper = objectMapper;
        this.fireBufferMeters = fireBufferMeters;
        this.maxDestinations = maxDestinations;
    }

    /**
     * Escape routes from where the caller is standing, towards the nearest assembly
     * points, along roads that do not run beside an active fire.
     */
    @GetMapping("/routes")
    public ResponseEntity<Map<String, Object>> routesFrom(
            @RequestParam @DecimalMin("-90.0") @DecimalMax("90.0") double lat,
            @RequestParam @DecimalMin("-180.0") @DecimalMax("180.0") double lng) {

        requireTopology();

        Integer start = evacuationRepository.findNearestVertex(lng, lat).orElse(null);
        if (start == null) {
            return ResponseEntity.ok(featureCollection(List.of()));
        }

        List<EvacuationRepository.Destination> destinations =
                evacuationRepository.findSafeDestinations(lng, lat, fireBufferMeters, maxDestinations);
        List<Integer> endVertices = EvacuationRepository.routableVertices(destinations);

        // The box the router may use: the caller plus every assembly point, widened for
        // detours. Loading the whole country per request is what made this endpoint take
        // over two minutes on the real road network.
        double[] points = new double[2 + destinations.size() * 2];
        points[0] = lng;
        points[1] = lat;
        for (int i = 0; i < destinations.size(); i++) {
            points[2 + i * 2] = destinations.get(i).lng();
            points[3 + i * 2] = destinations.get(i).lat();
        }
        EvacuationRepository.Bbox bbox = EvacuationRepository.Bbox.around(points);

        List<EvacuationRepository.EvacuationRoute> routes =
                evacuationRepository.findRoutesAvoidingFires(start, endVertices, fireBufferMeters, bbox);

        List<Object> features = new ArrayList<>();
        for (EvacuationRepository.EvacuationRoute route : routes) {
            if (route.geometryJson() == null) {
                continue;
            }
            EvacuationRepository.Destination destination = destinations.stream()
                    .filter(d -> Integer.valueOf(route.endVertex()).equals(d.vertexId()))
                    .findFirst()
                    .orElse(null);

            Map<String, Object> properties = new LinkedHashMap<>();
            properties.put("routeName", destination != null && destination.name() != null
                    ? "To " + destination.name()
                    : "Evacuation route");
            properties.put("destinationType", destination != null ? destination.type() : null);
            properties.put("status", "open");
            properties.put("totalCost", route.totalCost());
            properties.put("segments", route.segments());

            Map<String, Object> feature = new LinkedHashMap<>();
            feature.put("type", "Feature");
            feature.put("geometry", objectMapper.readTree(route.geometryJson()));
            feature.put("properties", properties);
            features.add(feature);
        }

        return ResponseEntity.ok(featureCollection(features));
    }

    @PostMapping("/route")
    public ResponseEntity<Map<String, Object>> route(@Valid @RequestBody EvacuationRouteRequest request) {
        requireTopology();

        Integer start = evacuationRepository.findNearestVertex(request.fromLng(), request.fromLat()).orElse(null);
        Integer end = evacuationRepository.findNearestVertex(request.toLng(), request.toLat()).orElse(null);
        if (start == null || end == null) {
            return ResponseEntity.notFound().build();
        }

        EvacuationRepository.Bbox bbox = EvacuationRepository.Bbox.around(
                request.fromLng(), request.fromLat(), request.toLng(), request.toLat());

        return evacuationRepository.findShortestPath(start, end, bbox)
                .map(row -> ResponseEntity.ok(Map.<String, Object>of(
                        "type", "Feature",
                        "geometry", objectMapper.readTree(row.geometryJson()),
                        "properties", Map.of(
                                "totalCost", row.totalCost(),
                                "segments", row.segments()))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private void requireTopology() {
        if (!evacuationRepository.hasRoutingTopology()) {
            throw new RoutingTopologyMissingException(
                    "Road routing topology is not imported. Run the osm2pgrouting import documented in "
                            + "db/postgres/scripts/README.md before requesting evacuation routes.");
        }
    }

    private static Map<String, Object> featureCollection(List<Object> features) {
        return Map.of("type", "FeatureCollection", "features", features);
    }
}
