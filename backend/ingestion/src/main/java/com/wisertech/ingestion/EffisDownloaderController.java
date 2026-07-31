package com.wisertech.ingestion;

import java.io.IOException;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EffisDownloaderController {
    private final EffisDownloaderService effisDownloaderService;

    public EffisDownloaderController(EffisDownloaderService effisDownloaderService) {
        this.effisDownloaderService = effisDownloaderService;
    }

    @PostMapping("/import/weather")
    public String importWeather() throws IOException, InterruptedException {
        int points = effisDownloaderService.fetchLatest();
        return "Published " + points + " FWI grid points.";
    }
}
