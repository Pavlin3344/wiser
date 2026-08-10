package com.wisertech.api;

import java.time.Instant;

public class CreateActiveFireRequest {
    private String source;
    private Instant detectedAt;
    private Short confidence;
    private Double frp;
    private Double latitude;
    private Double longitude;

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
    public Double getLatitude() {
        return latitude;
    }
    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }
    public Double getLongitude() {
        return longitude;
    }
    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }
    
}
