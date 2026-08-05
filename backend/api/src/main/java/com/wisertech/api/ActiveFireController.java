package com.wisertech.api;
import java.util.List;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
@RestController
public class ActiveFireController {
    private final ActiveFireRepository activeFireRepository;

    public ActiveFireController(ActiveFireRepository activeFireRepository) {
        this.activeFireRepository = activeFireRepository;
    }

    @GetMapping("/api/active-fires")
    public List<ActiveFire> getActiveFires() {
        return activeFireRepository.findAll();
    }
    @PostMapping("/api/active-fires")
public ActiveFire createActiveFire(@RequestBody CreateActiveFireRequest request) {  
    GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(),4326);
    Point point = geometryFactory.createPoint(new Coordinate(request.getLongitude(), request.getLatitude()));

    ActiveFire fire = new ActiveFire(request.getSource(), request.getDetectedAt(), request.getConfidence(), request.getFrp()); 
    fire.setGeom(point);  
    return activeFireRepository.save(fire);  
}

}
