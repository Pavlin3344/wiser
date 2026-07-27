package com.wisertech.api;

import java.time.Instant;
import java.time.LocalDate;

import org.locationtech.jts.geom.Polygon;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import tools.jackson.databind.annotation.JsonSerialize;

@Entity
@Table(name = "zones")
public class Zone {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    private Polygon geom;
    private Short fwiClass;
    private Double fwiValue;
    private Double ndviMean;
    private Integer fuelType;
    private Short riskClass;
    private Double riskScore;
    private Instant computedAt;
    private LocalDate validDate;

    public Zone() {
    }

    public Integer getId() {
        return id;
    }

    @JsonSerialize(using = PolygonSerializer.class)
    public Polygon getGeom() {
        return geom;
    }

    public void setGeom(Polygon geom) {
        this.geom = geom;
    }

    public Short getFwiClass() {
        return fwiClass;
    }

    public void setFwiClass(Short fwiClass) {
        this.fwiClass = fwiClass;
    }

    public Double getFwiValue() {
        return fwiValue;
    }

    public void setFwiValue(Double fwiValue) {
        this.fwiValue = fwiValue;
    }

    public Double getNdviMean() {
        return ndviMean;
    }

    public void setNdviMean(Double ndviMean) {
        this.ndviMean = ndviMean;
    }

    public Integer getFuelType() {
        return fuelType;
    }

    public void setFuelType(Integer fuelType) {
        this.fuelType = fuelType;
    }

    public Short getRiskClass() {
        return riskClass;
    }

    public void setRiskClass(Short riskClass) {
        this.riskClass = riskClass;
    }

    public Double getRiskScore() {
        return riskScore;
    }

    public void setRiskScore(Double riskScore) {
        this.riskScore = riskScore;
    }

    public Instant getComputedAt() {
        return computedAt;
    }

    public void setComputedAt(Instant computedAt) {
        this.computedAt = computedAt;
    }

    public LocalDate getValidDate() {
        return validDate;
    }

    public void setValidDate(LocalDate validDate) {
        this.validDate = validDate;
    }
}
