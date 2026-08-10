package com.wisertech.ingestion;

import java.io.IOException;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class OsmImportController {
    private final OsmImportService osmImportService;

    public OsmImportController(OsmImportService osmImportService) {
        this.osmImportService = osmImportService;
    }

    @PostMapping("/import/critical-infrastructure")
    public String importCriticalInfrastructure() throws IOException, InterruptedException {
        int imported = osmImportService.importCriticalInfrastructure();
        return "Imported " + imported + " new critical infrastructure records.";
    }
}
