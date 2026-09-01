package com.wisertech.ingestion;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Runs exactly one ingestion feed and returns, for deployments where the schedule lives
 * outside the application.
 *
 * <p>Under Compose the five feeds are timers inside one resident container. Under Container
 * Apps Jobs the platform's cron starts a container per feed, and a container that keeps
 * running after its work is done is not idle - it is a job the platform eventually kills at
 * its replica timeout and records as Failed. That is what every Java job here did: the EFFIS
 * download finished in under a minute and the execution was still marked Failed half an hour
 * later, which made a working pipeline look broken and hid the runs that genuinely fail.
 *
 * <p>Active only under the "job" profile, so nothing about the resident service changes.
 */
@Component
@Profile("job")
public class JobRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(JobRunner.class);

    private final EffisDownloaderService effisDownloaderService;
    private final FireIngestionService fireIngestionService;
    private final AirQualityService airQualityService;
    private final SentinelFetcherService sentinelFetcherService;
    private final OsmImportService osmImportService;
    private final String job;

    public JobRunner(
            EffisDownloaderService effisDownloaderService,
            FireIngestionService fireIngestionService,
            AirQualityService airQualityService,
            SentinelFetcherService sentinelFetcherService,
            OsmImportService osmImportService,
            @Value("${wiser.job:}") String job) {
        this.effisDownloaderService = effisDownloaderService;
        this.fireIngestionService = fireIngestionService;
        this.airQualityService = airQualityService;
        this.sentinelFetcherService = sentinelFetcherService;
        this.osmImportService = osmImportService;
        this.job = job;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        log.info("One-shot ingestion run starting: {}", job);

        switch (job) {
            case "effis" -> effisDownloaderService.fetchLatest();
            case "firms" -> fireIngestionService.ingestLatest();
            case "air-quality" -> airQualityService.fetchLatest();
            case "sentinel" -> sentinelFetcherService.fetchLatest();
            // scheduledImport(), not the unguarded import: osm.import.scheduled is off by
            // default because a country-wide Overpass query is expensive on a shared public
            // service, and moving the timer into the platform's cron is no reason to start
            // running it. Set OSM_IMPORT_SCHEDULED=true on this job to actually import.
            case "osm" -> osmImportService.scheduledImport();
            default -> throw new IllegalArgumentException(
                    "Unknown WISER_JOB '" + job + "'. Expected one of: effis, firms, air-quality, sentinel, osm.");
        }

        log.info("One-shot ingestion run complete: {}", job);
    }
}
