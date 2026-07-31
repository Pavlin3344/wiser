package com.wisertech.alerts;

import java.time.Instant;

import org.locationtech.jts.geom.Point;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "active_fires")
public class ActiveFire {
    @Id
    private Long id;
    private String source;
    private Instant detectedAt;
    private Short confidence;
    private Double frp;
    private Point geom;

    public ActiveFire() {
    }

    public Long getId() {
        return id;
    }

    public String getSource() {
        return source;
    }

    public Instant getDetectedAt() {
        return detectedAt;
    }

    public Short getConfidence() {
        return confidence;
    }

    public Double getFrp() {
        return frp;
    }

    public Point getGeom() {
        return geom;
    }
}
