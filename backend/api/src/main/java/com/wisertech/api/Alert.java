package com.wisertech.api;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "alerts")
public class Alert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long fireId;
    private String alertType;
    private String severity;
    private String targetType;
    private Long targetId;
    private String message;
    private Instant sentAt;
    private Instant acknowledgedAt;

    public Alert() {
    }

    public Long getId() {
        return id;
    }

    public Long getFireId() {
        return fireId;
    }

    public String getAlertType() {
        return alertType;
    }

    public String getSeverity() {
        return severity;
    }

    public String getTargetType() {
        return targetType;
    }

    public Long getTargetId() {
        return targetId;
    }

    public String getMessage() {
        return message;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public Instant getAcknowledgedAt() {
        return acknowledgedAt;
    }
}
