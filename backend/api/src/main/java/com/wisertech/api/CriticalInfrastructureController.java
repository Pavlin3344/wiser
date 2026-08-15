package com.wisertech.api;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CriticalInfrastructureController {
    private final CriticalInfrastructureRepository criticalInfrastructureRepository;

    public CriticalInfrastructureController(CriticalInfrastructureRepository criticalInfrastructureRepository) {
        this.criticalInfrastructureRepository = criticalInfrastructureRepository;
    }

    @GetMapping("/api/critical-infrastructure")
    public Page<CriticalInfrastructure> getCriticalInfrastructure(@PageableDefault(size = 100) Pageable pageable) {
        return criticalInfrastructureRepository.findAll(pageable);
    }
}
