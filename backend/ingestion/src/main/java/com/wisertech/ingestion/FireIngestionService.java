package com.wisertech.ingestion;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class FireIngestionService {
    private static final Logger log = LoggerFactory.getLogger(FireIngestionService.class);

    private final FireDetectionProvider fireDetectionProvider;
    private final ActiveFireRepository activeFireRepository;

    public FireIngestionService(FireDetectionProvider fireDetectionProvider, ActiveFireRepository activeFireRepository) {
        this.fireDetectionProvider = fireDetectionProvider;
        this.activeFireRepository = activeFireRepository;
    }

    @Scheduled(fixedRate = 3_600_000)
    public int ingestLatest() throws IOException, InterruptedException {
        int imported = 0;
        for (ActiveFire detection : fireDetectionProvider.fetchLatest()) {
            boolean duplicate = activeFireRepository.existsDuplicate(
                    detection.getSource(), detection.getDetectedAt(), detection.getGeom());
            if (duplicate) {
                continue;
            }
            activeFireRepository.save(detection);
            imported++;
        }
        log.info("Fire ingestion run complete: {} new detections imported.", imported);
        return imported;
    }
}
