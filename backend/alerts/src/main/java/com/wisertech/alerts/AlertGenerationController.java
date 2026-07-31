package com.wisertech.alerts;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AlertGenerationController {
    private final AlertGenerationService alertGenerationService;

    public AlertGenerationController(AlertGenerationService alertGenerationService) {
        this.alertGenerationService = alertGenerationService;
    }

    @PostMapping("/generate-alerts")
    public String generateAlerts() {
        int created = alertGenerationService.generateAlerts();
        return "Created " + created + " new alerts.";
    }
}
