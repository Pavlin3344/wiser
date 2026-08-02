package com.wisertech.ingestion;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

// This is the scenario that matters most for a reviewer: running the exact same poll
// result through the service twice must not double-insert. A plain unit test with a
// mocked repository wouldn't actually prove this - existsDuplicate is a real PostGIS
// query, so the guarantee only means something against a real database.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class FireIngestionServiceTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer(
            DockerImageName.parse("postgis/postgis:16-3.5").asCompatibleSubstituteFor("postgres"));

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired
    private ActiveFireRepository activeFireRepository;

    @Test
    void ingestLatest_rerunWithIdenticalDetections_insertsNothingTheSecondTime() throws Exception {
        ActiveFire detection = new ActiveFire(
                "MODIS_NRT",
                Instant.parse("2026-08-01T12:00:00Z"),
                (short) 75,
                22.5,
                GEOMETRY_FACTORY.createPoint(new Coordinate(23.32, 42.70)));
        // Same provider, called twice - simulates two hourly polls finding the same hotspot
        // still inside FIRMS's lookback window.
        FireDetectionProvider stubProvider = () -> List.of(detection);
        FireIngestionService service = new FireIngestionService(stubProvider, activeFireRepository);

        int firstRun = service.ingestLatest();
        int secondRun = service.ingestLatest();

        assertThat(firstRun).isEqualTo(1);
        assertThat(secondRun).isEqualTo(0);
        assertThat(activeFireRepository.count()).isEqualTo(1);
    }

    @Test
    void ingestLatest_newDetectionAfterExistingOne_isImported() throws Exception {
        ActiveFire first = new ActiveFire("MODIS_NRT", Instant.parse("2026-08-01T12:00:00Z"), (short) 75, 22.5,
                GEOMETRY_FACTORY.createPoint(new Coordinate(23.32, 42.70)));
        ActiveFire second = new ActiveFire("MODIS_NRT", Instant.parse("2026-08-01T13:00:00Z"), (short) 60, 18.0,
                GEOMETRY_FACTORY.createPoint(new Coordinate(24.10, 42.50)));

        FireIngestionService service = new FireIngestionService(() -> List.of(first), activeFireRepository);
        service.ingestLatest();

        FireIngestionService secondPoll = new FireIngestionService(() -> List.of(second), activeFireRepository);
        int imported = secondPoll.ingestLatest();

        assertThat(imported).isEqualTo(1);
        assertThat(activeFireRepository.count()).isEqualTo(2);
    }
}
