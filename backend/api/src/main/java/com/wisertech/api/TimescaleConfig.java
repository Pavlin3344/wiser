package com.wisertech.api;

import javax.sql.DataSource;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The time-series tables (FWI, weather, air quality) live in a separate TimescaleDB
 * instance from the PostGIS database that JPA maps.
 *
 * The connection pool is deliberately NOT exposed as a DataSource bean: Spring Boot's
 * DataSourceAutoConfiguration backs off as soon as any DataSource bean exists, which
 * would leave JPA - and Testcontainers' @ServiceConnection - without one. Only the
 * JdbcTemplate is published, so the primary datasource keeps its auto-configuration.
 */
@Configuration
public class TimescaleConfig implements DisposableBean {

    private DataSource timescaleDataSource;

    /**
     * Declared explicitly because publishing any JdbcOperations bean makes
     * JdbcTemplateAutoConfiguration back off. Without this the Timescale template would
     * be the only JdbcTemplate in the context, and repositories that inject one without
     * a qualifier - FireRepository, EvacuationRepository - would silently query the
     * wrong database.
     */
    @Bean
    @Primary
    JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    JdbcTemplate timescaleJdbcTemplate(
            @Value("${timescale.datasource.url}") String url,
            @Value("${timescale.datasource.username}") String username,
            @Value("${timescale.datasource.password}") String password) {
        this.timescaleDataSource = DataSourceBuilder.create()
                .url(url)
                .username(username)
                .password(password)
                .build();
        return new JdbcTemplate(timescaleDataSource);
    }

    // Closed explicitly because the pool is not a bean and so is not managed by Spring.
    @Override
    public void destroy() throws Exception {
        if (timescaleDataSource instanceof AutoCloseable closeable) {
            closeable.close();
        }
    }
}
