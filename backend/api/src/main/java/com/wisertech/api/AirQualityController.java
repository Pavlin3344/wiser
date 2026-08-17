package com.wisertech.api;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/api/v1/air-quality")
public class AirQualityController {

    private final AirQualityRepository airQualityRepository;

    public AirQualityController(AirQualityRepository airQualityRepository) {
        this.airQualityRepository = airQualityRepository;
    }

    /** Most recent reading per sampled point. */
    @GetMapping("/latest")
    public List<AirQualityRepository.AirQualityReading> latest() {
        return airQualityRepository.findLatest();
    }

    /** Hourly country-wide averages, for showing how pollution moved during a fire. */
    @GetMapping("/history")
    public List<AirQualityRepository.AirQualityAverage> history(
            @RequestParam(defaultValue = "24") @Min(1) @Max(720) int hours) {
        return airQualityRepository.findCountryAverages(hours);
    }
}
