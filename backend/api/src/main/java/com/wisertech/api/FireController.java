package com.wisertech.api;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FireController {

    private final FireGeoJsonService fireGeoJsonService;

    public FireController(FireGeoJsonService fireGeoJsonService) {
        this.fireGeoJsonService = fireGeoJsonService;
    }

    @GetMapping("/api/v1/fires/active")
    public Map<String, Object> activeFires() {
        return fireGeoJsonService.activeFiresAsFeatureCollection();
    }
}
