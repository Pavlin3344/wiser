package com.wisertech.api;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AlertController {
    private final AlertRepository alertRepository;

    public AlertController(AlertRepository alertRepository) {
        this.alertRepository = alertRepository;
    }

    @GetMapping("/api/alerts")
    public Page<Alert> getAlerts(@PageableDefault(size = 100) Pageable pageable) {
        return alertRepository.findAll(pageable);
    }
}
