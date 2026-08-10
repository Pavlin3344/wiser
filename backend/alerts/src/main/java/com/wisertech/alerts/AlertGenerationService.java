package com.wisertech.alerts;

import java.util.List;

import org.locationtech.jts.geom.Point;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class AlertGenerationService {
    private static final Logger log = LoggerFactory.getLogger(AlertGenerationService.class);
    private static final double EARTH_RADIUS_METERS = 6_371_000;

    private final ActiveFireRepository activeFireRepository;
    private final CriticalInfrastructureRepository criticalInfrastructureRepository;
    private final AlertRepository alertRepository;
    private final double proximityMeters;

    public AlertGenerationService(
            ActiveFireRepository activeFireRepository,
            CriticalInfrastructureRepository criticalInfrastructureRepository,
            AlertRepository alertRepository,
            @Value("${alerts.proximity-meters}") double proximityMeters) {
        this.activeFireRepository = activeFireRepository;
        this.criticalInfrastructureRepository = criticalInfrastructureRepository;
        this.alertRepository = alertRepository;
        this.proximityMeters = proximityMeters;
    }

    @Scheduled(fixedRate = 3_600_000) // hourly, matches the fire ingestion cadence
    public int generateAlerts() {
        int created = 0;
        for (ActiveFire fire : activeFireRepository.findAll()) {
            List<CriticalInfrastructure> nearby = criticalInfrastructureRepository.findWithinDistance(fire.getGeom(), proximityMeters);
            for (CriticalInfrastructure infra : nearby) {
                if (alertRepository.existsByFireIdAndTargetId(fire.getId(), infra.getId())) {
                    continue;
                }
                double distanceMeters = haversineMeters(fire.getGeom(), infra.getGeom());
                String name = infra.getName() != null ? infra.getName() : "unnamed";
                String message = "Fire detected %.0fm from %s (%s)".formatted(distanceMeters, name, infra.getType());
                alertRepository.save(new Alert(fire.getId(), "proximity", severityFor(distanceMeters), infra.getType(), infra.getId(), message));
                created++;
            }
        }
        log.info("Alert generation run complete: {} new alerts created.", created);
        return created;
    }

    // Package-private (not private) so AlertGenerationServiceTest can exercise the distance
    // boundaries directly, without mocking three repositories to reach this through generateAlerts().
    String severityFor(double meters) {
        if (meters < 1000) {
            return "critical";
        }
        if (meters < 2500) {
            return "high";
        }
        return "medium";
    }

    // Haversine here is just for the human-readable message text - the actual within-threshold
    // filtering already happened accurately in Postgres via ST_DWithin on geography.
    private double haversineMeters(Point a, Point b) {
        double lat1 = Math.toRadians(a.getY());
        double lat2 = Math.toRadians(b.getY());
        double dLat = Math.toRadians(b.getY() - a.getY());
        double dLon = Math.toRadians(b.getX() - a.getX());
        double h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
    }
}
