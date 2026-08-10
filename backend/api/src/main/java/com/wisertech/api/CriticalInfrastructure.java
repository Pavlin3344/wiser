package com.wisertech.api;

import org.locationtech.jts.geom.Point;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import tools.jackson.databind.annotation.JsonSerialize;

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

    @JsonSerialize(using = PointSerializer.class)
    public Point getGeom() {
        return geom;
    }
}
