package com.wisertech.api;
import java.time.Instant;

import org.locationtech.jts.geom.Point;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import tools.jackson.databind.annotation.JsonSerialize;

@Entity
@Table(name = "active_fires")
public class ActiveFire {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String source;
    private Instant detectedAt;
    private Short confidence;
    private Double frp;
    private Point geom;
   public ActiveFire() {
}

public ActiveFire(String source, Instant detectedAt, Short confidence, Double frp) {
    this.source = source;
    this.detectedAt = detectedAt;
    this.confidence = confidence;
    this.frp = frp;
}

public Long getId() {
    return id;
}

public String getSource() {
    return source;
}

public void setSource(String source) {
    this.source = source;
}

public Instant getDetectedAt() {
    return detectedAt;
}

public void setDetectedAt(Instant detectedAt) {
    this.detectedAt = detectedAt;
}

public Short getConfidence() {
    return confidence;
}

public void setConfidence(Short confidence) {
    this.confidence = confidence;
}

public Double getFrp() {
    return frp;
}

public void setFrp(Double frp) {
    this.frp = frp;
}
@JsonSerialize(using = PointSerializer.class)
public Point getGeom(){
    return geom;
}
public void setGeom(Point geom){
    this.geom = geom;
}
}
