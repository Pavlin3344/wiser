package com.wisertech.ingestion;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

// Guards HTTP endpoints, so it only applies when there is an HTTP server. A one-shot job
// run (WISER_JOB set) starts with WebApplicationType.NONE, which means Spring Security's
// web auto-configuration never runs and HttpSecurity is not a bean - leaving this active
// there fails the whole context with "Parameter 0 of method filterChain ... required a
// bean of type HttpSecurity". Same @Profile("!job") split as SchedulingConfig.
@Configuration
@Profile("!job")
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, @Value("${wiser.api-key:}") String apiKey) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new ApiKeyAuthFilter(apiKey), UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/prometheus").permitAll()
                        // Every endpoint here is an operator trigger, not public data.
                        .anyRequest().hasAuthority(ApiKeyAuthFilter.ROLE));
        return http.build();
    }
}
