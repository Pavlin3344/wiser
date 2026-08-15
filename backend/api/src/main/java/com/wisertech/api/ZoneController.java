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

    // Under /api so nginx actually proxies it - only "location /api/" is forwarded
    // to the backend, so the old /zones/risk path was unreachable in production.
    @GetMapping("/api/zones/risk")
    public List<Zone> getRiskZones() {
        return zoneRepository.findAll();
    }
}
