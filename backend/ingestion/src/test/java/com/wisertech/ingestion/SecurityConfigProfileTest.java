package com.wisertech.ingestion;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

/**
 * SecurityConfig must not load in a one-shot job run, and must still load in the resident
 * service.
 *
 * <p>The regression this pins: a job starts with WebApplicationType.NONE, so Spring
 * Security's servlet auto-configuration never runs and no HttpSecurity bean exists.
 * SecurityConfig.filterChain takes HttpSecurity as a parameter, so leaving it active in a
 * job failed the entire context - every Java job on Azure logged "APPLICATION FAILED TO
 * START" until SecurityConfig gained @Profile("!job"). A non-web ApplicationContextRunner
 * reproduces exactly that condition; JobRunnerTest could not, because it never starts a
 * context at all.
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
