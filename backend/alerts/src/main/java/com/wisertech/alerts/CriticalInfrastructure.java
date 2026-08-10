package com.wisertech.alerts;

import org.locationtech.jts.geom.Point;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "critical_infrastructure")
public class CriticalInfrastructure {
    @Id
    private Long id;
    private Long osmId;
    private String name;
    private String type;
    private Point geom;

    public CriticalInfrastructure() {
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
