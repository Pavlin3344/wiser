package com.wisertech.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
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
                        // Read-only map data the public dashboard needs. The SPA is static and
                        // served to browsers, so it cannot hold a secret to present here.
                        .requestMatchers(HttpMethod.GET, "/api/v1/fires/active", "/api/v1/fires/stream").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/fires/daily-counts").permitAll()
                        // Read-only alert feed the dashboard renders; writes stay protected.
                        .requestMatchers(HttpMethod.GET, "/api/alerts").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/zones/risk").permitAll()
                        // The dashboard needs escape routes for whoever is looking at it,
                        // and it cannot hold a secret to ask for them.
                        .requestMatchers(HttpMethod.GET, "/api/evacuation/routes").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        // Not proxied by nginx, so only reachable from the Docker network.
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/prometheus").permitAll()
                        .anyRequest().hasAuthority(ApiKeyAuthFilter.ROLE));
        return http.build();
    }
}
