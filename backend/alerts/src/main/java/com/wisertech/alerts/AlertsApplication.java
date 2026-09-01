package com.wisertech.alerts;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AlertsApplication {

    /**
     * Any non-empty value runs a single alert pass and exits instead of starting the
     * resident service. Unset keeps the original behaviour.
     */
    static final String JOB_ENV = "WISER_JOB";

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(AlertsApplication.class);
        String job = System.getenv(JOB_ENV);

        if (job == null || job.isBlank()) {
            app.run(args);
            return;
        }

        // See IngestionApplication for why a batch run drops Tomcat and exits explicitly.
        app.setWebApplicationType(WebApplicationType.NONE);
        app.setAdditionalProfiles("job");
        System.exit(SpringApplication.exit(app.run(args)));
    }
}
