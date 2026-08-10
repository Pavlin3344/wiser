package com.wisertech.ingestion;

import java.io.IOException;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SentinelFetcherController {
    private final SentinelFetcherService sentinelFetcherService;

    public SentinelFetcherController(SentinelFetcherService sentinelFetcherService) {
        this.sentinelFetcherService = sentinelFetcherService;
    }

    @PostMapping("/import/sentinel-scene")
    public String importSentinelScene() throws IOException, InterruptedException {
        sentinelFetcherService.fetchLatest();
        return "Sentinel-2 scene fetched and published.";
    }
}
