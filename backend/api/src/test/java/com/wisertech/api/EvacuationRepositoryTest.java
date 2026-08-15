package com.wisertech.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jdbc.test.autoconfigure.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * The fire-avoidance rule only means something against real pgRouting, so this builds a
 * tiny road network by hand:
 *
 *   A(0,0) --1-- B(1,0) --2-- C(2,0)      <- direct corridor, passes the fire at (1, 0)
 *      \                        /
 *       3                      4
 *        \                    /
 *         D(0,-1) --5-- E(2,-1)           <- detour to the south, clear of the fire
 *
 * Shelter sits at C. With no fire the router should take the short northern corridor;
 * with a fire beside B it must return the longer southern detour instead.
 */
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
@Import(EvacuationRepository.class)
class EvacuationRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer(
            DockerImageName.parse("pgrouting/pgrouting:16-3.5-4.0").asCompatibleSubstituteFor("postgres"));

    private static final double BUFFER_METERS = 5_000;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EvacuationRepository repository;

    @BeforeEach
    void seed() {
        jdbc.execute("CREATE EXTENSION IF NOT EXISTS postgis");
        jdbc.execute("CREATE EXTENSION IF NOT EXISTS pgrouting");
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS roads (
                id BIGSERIAL PRIMARY KEY, osm_id BIGINT, name TEXT, highway TEXT,
                source INTEGER, target INTEGER, cost FLOAT, reverse_cost FLOAT,
                passable BOOLEAN DEFAULT TRUE, geom GEOMETRY(LineString, 4326) NOT NULL)
            """);
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS active_fires (
                id BIGSERIAL PRIMARY KEY, source TEXT NOT NULL, detected_at TIMESTAMPTZ NOT NULL,
                confidence SMALLINT, frp FLOAT, geom GEOMETRY(Point, 4326) NOT NULL,
                perimeter GEOMETRY(Polygon, 4326), properties JSONB)
            """);
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS critical_infrastructure (
                id BIGSERIAL PRIMARY KEY, osm_id BIGINT UNIQUE, name TEXT, type TEXT NOT NULL,
                geom GEOMETRY(Point, 4326) NOT NULL, properties JSONB, updated_at TIMESTAMPTZ DEFAULT NOW())
            """);

        jdbc.execute("TRUNCATE roads, active_fires, critical_infrastructure RESTART IDENTITY");

        // Vertices: 1=A(0,0) 2=B(1,0) 3=C(2,0) 4=D(0,-1) 5=E(2,-1)
        addRoad(1, 2, 1, "0 0, 1 0");
        addRoad(2, 3, 1, "1 0, 2 0");
        addRoad(1, 4, 1, "0 0, 0 -1");
        addRoad(4, 5, 1, "0 -1, 2 -1");
        addRoad(5, 3, 1, "2 -1, 2 0");

        jdbc.update("INSERT INTO critical_infrastructure (name, type, geom) VALUES (?, ?, ST_SetSRID(ST_MakePoint(2, 0), 4326))",
                "North Shelter", "school");
    }

    private void addRoad(int source, int target, double cost, String lineString) {
        jdbc.update("""
                INSERT INTO roads (source, target, cost, reverse_cost, passable, geom)
                VALUES (?, ?, ?, ?, true, ST_SetSRID(ST_GeomFromText('LINESTRING(%s)'), 4326))
                """.formatted(lineString), source, target, cost, cost);
    }

    private void igniteFireBeside(double lng, double lat) {
        jdbc.update("INSERT INTO active_fires (source, detected_at, geom) VALUES ('TEST', NOW(), ST_SetSRID(ST_MakePoint(?, ?), 4326))",
                lng, lat);
    }

    @Test
    void reportsTopologyPresence() {
        assertThat(repository.hasRoutingTopology()).isTrue();

        jdbc.execute("UPDATE roads SET source = NULL, target = NULL");
        assertThat(repository.hasRoutingTopology()).isFalse();
    }

    @Test
    void withoutFiresTakesTheDirectCorridor() {
        List<EvacuationRepository.Destination> destinations = repository.findSafeDestinations(0, 0, BUFFER_METERS, 3);
        assertThat(destinations).hasSize(1);

        List<EvacuationRepository.EvacuationRoute> routes = repository.findRoutesAvoidingFires(
                1, EvacuationRepository.routableVertices(destinations), BUFFER_METERS);

        assertThat(routes).hasSize(1);
        assertThat(routes.getFirst().segments()).isEqualTo(2);
    }

    // The heart of the feature: a fire beside B must push the route onto the southern
    // detour rather than routing evacuees straight past the fire.
    @Test
    void routesAroundRoadsRunningBesideAFire() {
        igniteFireBeside(1, 0);

        List<EvacuationRepository.Destination> destinations = repository.findSafeDestinations(0, 0, BUFFER_METERS, 3);
        List<EvacuationRepository.EvacuationRoute> routes = repository.findRoutesAvoidingFires(
                1, EvacuationRepository.routableVertices(destinations), BUFFER_METERS);

        assertThat(routes).hasSize(1);
        assertThat(routes.getFirst().segments())
                .describedAs("should take the 3-segment southern detour, not the 2-segment corridor past the fire")
                .isEqualTo(3);
    }

    @Test
    void doesNotOfferShelterThatIsItselfOnFire() {
        igniteFireBeside(2, 0);

        assertThat(repository.findSafeDestinations(0, 0, BUFFER_METERS, 3)).isEmpty();
    }

    @Test
    void returnsNoRouteWhenEveryPathPassesAFire() {
        igniteFireBeside(1, 0);
        igniteFireBeside(1, -1);

        List<EvacuationRepository.Destination> destinations = repository.findSafeDestinations(0, 0, BUFFER_METERS, 3);
        List<EvacuationRepository.EvacuationRoute> routes = repository.findRoutesAvoidingFires(
                1, EvacuationRepository.routableVertices(destinations), BUFFER_METERS);

        assertThat(routes).isEmpty();
    }
}
