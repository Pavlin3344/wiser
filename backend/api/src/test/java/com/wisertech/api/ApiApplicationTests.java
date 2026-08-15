package com.wisertech.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

// Boots the whole application against a throwaway database so bean wiring problems
// (security chain, SSE service, repositories) fail here rather than on the server.
// Uses the same pgRouting image as production and applies the real migrations, because
// ddl-auto=validate means the entity mappings are checked against the actual schema.
@SpringBootTest
@Testcontainers
@TestPropertySource(properties = {
        "spring.flyway.enabled=true",
        "spring.flyway.locations=filesystem:../../db/postgres/migrations",
        "POSTGRES_PASSWORD=unused-testcontainers-manages-credentials"
})
class ApiApplicationTests {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer(
            DockerImageName.parse("pgrouting/pgrouting:16-3.5-4.0").asCompatibleSubstituteFor("postgres"));

    @Test
    void contextLoads() {
    }
}
