package com.wisertech.ingestion;

import org.locationtech.jts.geom.Point;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "critical_infrastructure")
public class CriticalInfrastructure {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long osmId;
    private String name;
    private String type;
    private Point geom;

    public CriticalInfrastructure() {
    }

    public CriticalInfrastructure(Long osmId, String name, String type, Point geom) {
        this.osmId = osmId;
        this.name = name;
        this.type = type;
        this.geom = geom;
    }

    public Long getId() {
        return id;
    }

    public Long getOsmId() {
        return osmId;
    }

    public String getName() {
        return name;
    }

    public String getType() {
        return type;
    }

    public Point getGeom() {
        return geom;
    }
}
