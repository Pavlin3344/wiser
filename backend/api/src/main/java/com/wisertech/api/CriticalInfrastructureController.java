package com.wisertech.api;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CriticalInfrastructureController {
    private final CriticalInfrastructureRepository criticalInfrastructureRepository;

    public CriticalInfrastructureController(CriticalInfrastructureRepository criticalInfrastructureRepository) {
        this.criticalInfrastructureRepository = criticalInfrastructureRepository;
    }

    @GetMapping("/api/critical-infrastructure")
    public List<CriticalInfrastructure> getCriticalInfrastructure() {
        return criticalInfrastructureRepository.findAll();
    }
}
