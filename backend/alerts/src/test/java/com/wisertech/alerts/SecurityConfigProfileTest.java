package com.wisertech.alerts;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

/**
 * SecurityConfig must not load in a one-shot job run, and must still load in the resident
 * service. See the ingestion service's copy for the full story: without @Profile("!job")
 * the hourly alerts job failed at "APPLICATION FAILED TO START", because a non-servlet
 * context has no HttpSecurity bean for filterChain to take.
 */
class SecurityConfigProfileTest {

    @Test
    void filterChainIsAbsentInAJobContext() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(ServletWebSecurityAutoConfiguration.class))
                .withUserConfiguration(SecurityConfig.class)
                .withPropertyValues("spring.profiles.active=job")
                .run(context -> assertThat(context)
                        .hasNotFailed()
                        .doesNotHaveBean("filterChain"));
    }

    @Test
    void filterChainIsPresentInTheResidentService() {
        new WebApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(ServletWebSecurityAutoConfiguration.class))
                .withUserConfiguration(SecurityConfig.class)
                .run(context -> assertThat(context)
                        .hasNotFailed()
                        .hasBean("filterChain"));
    }
}
