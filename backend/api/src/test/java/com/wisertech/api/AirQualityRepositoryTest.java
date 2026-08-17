package com.wisertech.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Boots the app against BOTH databases at once. This is the test that would have caught
 * the configuration trap behind it: declaring a DataSource bean for TimescaleDB silently
 * switches off auto-configuration for the primary PostGIS one, and the app then talks to
 * the wrong database - or to none at all.
 */
@SpringBootTest
@ExtendWith(SpringExtension.class)
@Testcontainers
@TestPropertySource(properties = {
        "spring.flyway.enabled=true",
        "spring.flyway.locations=filesystem:../../db/postgres/migrations",
        "POSTGRES_PASSWORD=unused-testcontainers-manages-credentials"
})
class AirQualityRepositoryTest {

    @Container
    static PostgreSQLContainer postgis = new PostgreSQLContainer(
            DockerImageName.parse("pgrouting/pgrouting:16-3.5-4.0").asCompatibleSubstituteFor("postgres"));

    @Container
    static PostgreSQLContainer timescale = new PostgreSQLContainer(
            DockerImageName.parse("timescale/timescaledb:2.28.1-pg16").asCompatibleSubstituteFor("postgres"));

    @DynamicPropertySource
    static void datasources(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgis::getJdbcUrl);
        registry.add("spring.datasource.username", postgis::getUsername);
        registry.add("spring.datasource.password", postgis::getPassword);

        registry.add("timescale.datasource.url", timescale::getJdbcUrl);
        registry.add("timescale.datasource.username", timescale::getUsername);
        registry.add("timescale.datasource.password", timescale::getPassword);
    }

    @Autowired
    private AirQualityRepository repository;

    @Autowired
    @org.springframework.beans.factory.annotation.Qualifier("timescaleJdbcTemplate")
    private JdbcTemplate timescaleJdbc;

    @BeforeEach
    void seed() {
        timescaleJdbc.execute("CREATE EXTENSION IF NOT EXISTS timescaledb");
        timescaleJdbc.execute("""
            CREATE TABLE IF NOT EXISTS air_quality (
                time TIMESTAMPTZ NOT NULL, lat FLOAT, lon FLOAT, source TEXT,
                no2 FLOAT, pm25 FLOAT, pm10 FLOAT, co FLOAT)
            """);
        timescaleJdbc.execute("SELECT create_hypertable('air_quality', 'time', if_not_exists => TRUE)");
        timescaleJdbc.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS air_quality_unique_reading
                ON air_quality (time, lat, lon, source)
            """);
        timescaleJdbc.execute("TRUNCATE air_quality");
    }

    private void insert(String ago, double lat, double lon, double pm25) {
        timescaleJdbc.update(
                "INSERT INTO air_quality (time, lat, lon, source, no2, pm25, pm10, co) "
                        + "VALUES (NOW() - INTERVAL '" + ago + "', ?, ?, 'test', 1, ?, 3, 4)",
                lat, lon, pm25);
    }

    @Test
    void returnsOnlyTheNewestReadingPerPoint() {
        insert("3 hours", 42.0, 24.0, 10);
        insert("1 hour", 42.0, 24.0, 55);
        insert("2 hours", 43.0, 25.0, 20);

        List<AirQualityRepository.AirQualityReading> latest = repository.findLatest();

        assertThat(latest).hasSize(2);
        assertThat(latest)
                .filteredOn(r -> r.lat() == 42.0)
                .singleElement()
                .satisfies(r -> assertThat(r.pm25()).isEqualTo(55.0));
    }

    @Test
    void ignoresReadingsOlderThanADay() {
        insert("30 hours", 42.0, 24.0, 10);

        assertThat(repository.findLatest()).isEmpty();
    }

    @Test
    void bucketsHistoryByHour() {
        insert("1 hour", 42.0, 24.0, 10);
        insert("1 hour", 43.0, 25.0, 20);

        List<AirQualityRepository.AirQualityAverage> history = repository.findCountryAverages(6);

        assertThat(history).isNotEmpty();
        assertThat(history.getLast().pm25()).isEqualTo(15.0); // average of the two points
    }

    // The whole point of the two-datasource setup: JPA must still reach PostGIS.
    @Test
    void primaryDatabaseIsStillThePostgisOne(@Autowired JdbcTemplate primaryJdbc) {
        Integer roads = primaryJdbc.queryForObject("SELECT COUNT(*) FROM roads", Integer.class);
        assertThat(roads).isNotNull();
    }
}
