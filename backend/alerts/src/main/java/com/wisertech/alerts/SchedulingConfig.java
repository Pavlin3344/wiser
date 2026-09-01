package com.wisertech.alerts;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Scheduling, enabled for the resident service and only for it.
 *
 * <p>Moved off {@link AlertsApplication} so a job run does not arm the hourly timer it is
 * standing in for. See the same class in the ingestion service for the longer version.
 */
@Configuration
@Profile("!job")
@EnableScheduling
public class SchedulingConfig {
}
