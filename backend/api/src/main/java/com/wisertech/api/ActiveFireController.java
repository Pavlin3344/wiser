package com.wisertech.api;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
public class ActiveFireController {
    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    private final ActiveFireRepository activeFireRepository;

    public ActiveFireController(ActiveFireRepository activeFireRepository) {
        this.activeFireRepository = activeFireRepository;
    }

    @GetMapping("/api/active-fires")
    public Page<ActiveFire> getActiveFires(@PageableDefault(size = 100) Pageable pageable) {
        return activeFireRepository.findAll(pageable);
    }

    @PostMapping("/api/active-fires")
    public ActiveFire createActiveFire(@Valid @RequestBody CreateActiveFireRequest request) {
        Point point = GEOMETRY_FACTORY.createPoint(new Coordinate(request.getLongitude(), request.getLatitude()));

        ActiveFire fire = new ActiveFire(request.getSource(), request.getDetectedAt(), request.getConfidence(), request.getFrp());
        fire.setGeom(point);
        return activeFireRepository.save(fire);
    }
}
