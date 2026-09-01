package com.wisertech.ingestion;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Scheduling, enabled for the resident service and only for it.
 *
 * <p>This used to sit on {@link IngestionApplication} itself, which meant every start
 * armed all five feeds. That is right for the Compose deployment, where one long-lived
 * container owns every schedule. It is wrong under a job runner, where the platform's cron
 * decides what runs and the container is expected to do that one thing and exit: with the
 * timers armed, a job asked for EFFIS also fetched air quality, FIRMS and Sentinel.
 *
 * <p>The "job" profile is set by {@link IngestionApplication} when WISER_JOB names a task,
 * so the default deployment keeps exactly the behaviour it had.
 */
@Configuration
@Profile("!job")
@EnableScheduling
public class SchedulingConfig {
}
