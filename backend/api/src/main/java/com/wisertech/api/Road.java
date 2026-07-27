package com.wisertech.api;

import org.locationtech.jts.geom.LineString;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import tools.jackson.databind.annotation.JsonSerialize;

@Entity
@Table(name = "roads")
public class Road {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long osmId;
    private String name;
    private String highway;
    private Integer source;
    private Integer target;
    private Float cost;
    private Float reverseCost;
    private Boolean passable;
    private LineString geom;

    public Road() {
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

    public String getHighway() {
        return highway;
    }

    public Integer getSource() {
        return source;
    }

    public Integer getTarget() {
        return target;
    }

    public Float getCost() {
        return cost;
    }

    public Float getReverseCost() {
        return reverseCost;
    }

    public Boolean getPassable() {
        return passable;
    }

    @JsonSerialize(using = LineStringSerializer.class)
    public LineString getGeom() {
        return geom;
    }
}
