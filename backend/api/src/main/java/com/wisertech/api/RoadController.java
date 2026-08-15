package com.wisertech.api;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RoadController {
    private final RoadRepository roadRepository;

    public RoadController(RoadRepository roadRepository) {
        this.roadRepository = roadRepository;
    }

    // The roads table holds the whole Bulgarian road network once imported, so an
    // unpaged findAll would try to serialise hundreds of thousands of geometries.
    @GetMapping("/api/roads")
    public Page<Road> getRoads(@PageableDefault(size = 100) Pageable pageable) {
        return roadRepository.findAll(pageable);
    }
}
