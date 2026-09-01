package com.wisertech.ingestion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.resilience.annotation.EnableResilientMethods;

@SpringBootApplication
@EnableResilientMethods
public class IngestionApplication {

    /**
     * Names a single feed to run before exiting, instead of arming all five on timers.
     * Unset (Compose, and anything else that wants the resident service) keeps the
     * original behaviour untouched.
     */
    static final String JOB_ENV = "WISER_JOB";

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(IngestionApplication.class);
        String job = System.getenv(JOB_ENV);

        if (job == null || job.isBlank()) {
            app.run(args);
            return;
        }

        // No Tomcat: a batch run serves nothing, and a listening port is the reason the
        // process outlived its work. Then exit on the code the runner produced, so a
        // finished job reads as finished rather than being killed at the replica timeout
        // and recorded as Failed - which is what every Java job on Azure was doing while
        // its actual work succeeded.
        app.setWebApplicationType(WebApplicationType.NONE);
        app.setAdditionalProfiles("job");
        System.exit(SpringApplication.exit(app.run(args)));
    }
}
