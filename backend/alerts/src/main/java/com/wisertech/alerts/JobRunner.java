package com.wisertech.alerts;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Runs one proximity-alert pass and returns, for deployments where the schedule lives
 * outside the application.
 *
 * <p>Unlike the ingestion service this has only one task, so WISER_JOB here selects the
 * mode rather than the work: any non-empty value means "run the pass and exit".
 */
@Component
@Profile("job")
public class JobRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(JobRunner.class);

    private final AlertGenerationService alertGenerationService;

    public JobRunner(AlertGenerationService alertGenerationService) {
        this.alertGenerationService = alertGenerationService;
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("One-shot alert generation starting.");
        int created = alertGenerationService.generateAlerts();
        log.info("One-shot alert generation complete: {} alerts created.", created);
    }
}
