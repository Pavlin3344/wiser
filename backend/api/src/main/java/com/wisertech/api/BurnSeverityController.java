package com.wisertech.api;

import java.util.List;

import org.springframework.data.domain.Limit;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BurnSeverityController {

    // Enough to fill the panel and the map without an unbounded response. The cap is a
    // safety rail rather than paging - if this ever needs paging, it needs a Pageable.
    private static final int MAX_RESULTS = 100;

    private final BurnSeverityRepository burnSeverityRepository;

    public BurnSeverityController(BurnSeverityRepository burnSeverityRepository) {
        this.burnSeverityRepository = burnSeverityRepository;
    }

    /**
     * Completed post-fire analyses, most recent first.
     *
     * Under /api so nginx proxies it - only "location /api/" is forwarded to the backend.
     */
    @GetMapping("/api/burn-severity")
    public List<BurnSeverity> getBurnSeverity(@RequestParam(defaultValue = "20") int limit) {
        int capped = Math.max(1, Math.min(limit, MAX_RESULTS));
        return burnSeverityRepository.findAllByOrderByPostDateDescComputedAtDesc(Limit.of(capped));
    }
}
