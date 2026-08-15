package com.wisertech.api;

import java.time.Instant;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CreateActiveFireRequest {
    @NotBlank
    private String source;

    @NotNull
    private Instant detectedAt;

    @DecimalMin("0") @DecimalMax("100")
    private Short confidence;

    @DecimalMin("0")
    private Double frp;

    @NotNull @DecimalMin("-90.0") @DecimalMax("90.0")
    private Double latitude;

    @NotNull @DecimalMin("-180.0") @DecimalMax("180.0")
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
