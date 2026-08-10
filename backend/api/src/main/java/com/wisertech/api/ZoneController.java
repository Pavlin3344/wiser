package com.wisertech.api;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ZoneController {
    private final ZoneRepository zoneRepository;

    public ZoneController(ZoneRepository zoneRepository) {
        this.zoneRepository = zoneRepository;
    }

    @GetMapping("/zones/risk")
    public List<Zone> getRiskZones() {
        return zoneRepository.findAll();
    }
}
