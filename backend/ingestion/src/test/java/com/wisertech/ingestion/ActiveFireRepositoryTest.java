package com.wisertech.ingestion;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

// Real Postgres+PostGIS via Testcontainers, not H2 - ST_Equals is a PostGIS function,
// so this has to run against the real thing to mean anything.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class ActiveFireRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer(
            DockerImageName.parse("postgis/postgis:16-3.5").asCompatibleSubstituteFor("postgres"));

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired
    private ActiveFireRepository activeFireRepository;

    private static Point point(double lon, double lat) {
        return GEOMETRY_FACTORY.createPoint(new Coordinate(lon, lat));
    }

    @Test
    void existsDuplicate_true_forSameSourceTimestampAndExactLocation() {
        Instant detectedAt = Instant.parse("2026-08-01T12:00:00Z");
        activeFireRepository.save(new ActiveFire("MODIS_NRT", detectedAt, (short) 80, 15.0, point(23.32, 42.70)));

        // Rebuilt independently from the same raw numbers, like FIRMS parsing the same CSV row twice.
        boolean duplicate = activeFireRepository.existsDuplicate("MODIS_NRT", detectedAt, point(23.32, 42.70));

        assertThat(duplicate).isTrue();
    }

    @Test
    void existsDuplicate_false_whenSourceDiffers() {
        Instant detectedAt = Instant.parse("2026-08-01T12:00:00Z");
        activeFireRepository.save(new ActiveFire("MODIS_NRT", detectedAt, (short) 80, 15.0, point(23.32, 42.70)));

        boolean duplicate = activeFireRepository.existsDuplicate("VIIRS_NRT", detectedAt, point(23.32, 42.70));

        assertThat(duplicate).isFalse();
    }

    @Test
    void existsDuplicate_false_whenTimestampDiffers() {
        activeFireRepository.save(new ActiveFire("MODIS_NRT", Instant.parse("2026-08-01T12:00:00Z"), (short) 80, 15.0, point(23.32, 42.70)));

        boolean duplicate = activeFireRepository.existsDuplicate("MODIS_NRT", Instant.parse("2026-08-01T13:00:00Z"), point(23.32, 42.70));

        assertThat(duplicate).isFalse();
    }

    @Test
    void existsDuplicate_false_whenLocationDiffers() {
        Instant detectedAt = Instant.parse("2026-08-01T12:00:00Z");
        activeFireRepository.save(new ActiveFire("MODIS_NRT", detectedAt, (short) 80, 15.0, point(23.32, 42.70)));

        // A neighbouring pixel, not the same hotspot.
        boolean duplicate = activeFireRepository.existsDuplicate("MODIS_NRT", detectedAt, point(23.33, 42.70));

        assertThat(duplicate).isFalse();
    }
}
