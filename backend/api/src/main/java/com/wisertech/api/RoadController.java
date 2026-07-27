package com.wisertech.api;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RoadController {
    private final RoadRepository roadRepository;

    public RoadController(RoadRepository roadRepository) {
        this.roadRepository = roadRepository;
    }

    @GetMapping("/api/roads")
    public List<Road> getRoads() {
        return roadRepository.findAll();
    }
}
