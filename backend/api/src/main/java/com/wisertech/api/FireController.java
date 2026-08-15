package com.wisertech.api;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
public class FireController {

    private final FireGeoJsonService fireGeoJsonService;
    private final FireRepository fireRepository;

    public FireController(FireGeoJsonService fireGeoJsonService, FireRepository fireRepository) {
        this.fireGeoJsonService = fireGeoJsonService;
        this.fireRepository = fireRepository;
    }

    @GetMapping("/api/v1/fires/active")
    public Map<String, Object> activeFires() {
        return fireGeoJsonService.activeFiresAsFeatureCollection();
    }

    /** Detections per day, for the trends chart. Includes days with zero detections. */
    @GetMapping("/api/v1/fires/daily-counts")
    public List<FireRepository.DailyFireCount> dailyCounts(
            @RequestParam(defaultValue = "7") @Min(1) @Max(90) int days) {
        return fireRepository.findDailyCounts(days);
    }
}
