package com.wisertech.ingestion;

import java.io.IOException;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FireIngestionController {
    private final FireIngestionService fireIngestionService;

    public FireIngestionController(FireIngestionService fireIngestionService) {
        this.fireIngestionService = fireIngestionService;
    }

    @PostMapping("/import/fire-detections")
    public String importFireDetections() throws IOException, InterruptedException {
        int imported = fireIngestionService.ingestLatest();
        return "Imported " + imported + " new fire detections.";
    }
}
