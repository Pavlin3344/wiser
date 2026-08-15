package com.wisertech.ingestion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import tools.jackson.databind.json.JsonMapper;
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

    private final RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);

    private FireIngestionService serviceFor(FireDetectionProvider provider) {
        return new FireIngestionService(provider, activeFireRepository, rabbitTemplate,
                JsonMapper.builder().build(), new SimpleMeterRegistry());
    }

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
        FireIngestionService service = serviceFor(stubProvider);

        int firstRun = service.ingestLatest();
        int secondRun = service.ingestLatest();

        assertThat(firstRun).isEqualTo(1);
        assertThat(secondRun).isEqualTo(0);
        assertThat(activeFireRepository.count()).isEqualTo(1);
    }

    // The API service turns this message into an SSE push, so a run that imported
    // nothing must stay silent rather than waking every connected dashboard.
    @Test
    void ingestLatest_publishesOnlyWhenSomethingWasImported() throws Exception {
        ActiveFire detection = new ActiveFire(
                "MODIS_NRT",
                Instant.parse("2026-08-01T12:00:00Z"),
                (short) 75,
                22.5,
                GEOMETRY_FACTORY.createPoint(new Coordinate(23.32, 42.70)));
        FireIngestionService service = serviceFor(() -> List.of(detection));

        service.ingestLatest();
        verify(rabbitTemplate).send(eq("fire.exchange"), eq("fire.detections"), any(Message.class));

        // The second run is an exact duplicate, so the total stays at one publish.
        service.ingestLatest();
        verify(rabbitTemplate, times(1))
                .send(eq("fire.exchange"), eq("fire.detections"), any(Message.class));
    }

    @Test
    void ingestLatest_newDetectionAfterExistingOne_isImported() throws Exception {
        ActiveFire first = new ActiveFire("MODIS_NRT", Instant.parse("2026-08-01T12:00:00Z"), (short) 75, 22.5,
                GEOMETRY_FACTORY.createPoint(new Coordinate(23.32, 42.70)));
        ActiveFire second = new ActiveFire("MODIS_NRT", Instant.parse("2026-08-01T13:00:00Z"), (short) 60, 18.0,
                GEOMETRY_FACTORY.createPoint(new Coordinate(24.10, 42.50)));

        FireIngestionService service = serviceFor(() -> List.of(first));
        service.ingestLatest();

        FireIngestionService secondPoll = serviceFor(() -> List.of(second));
        int imported = secondPoll.ingestLatest();

        assertThat(imported).isEqualTo(1);
        assertThat(activeFireRepository.count()).isEqualTo(2);
    }
}
