package com.wisertech.api;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(
            HttpSecurity http,
            @Value("${wiser.api-key:}") String apiKey,
            CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                // Security's filter chain runs before WebConfig's MVC-level CORS mapping
                // ever sees the request, so that mapping alone never applied here - a
                // cross-origin browser call would have been rejected before reaching a
                // controller. Same allowed-origins property, just wired in earlier too.
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new ApiKeyAuthFilter(apiKey), UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        // Read-only map data the public dashboard needs. The SPA is static and
                        // served to browsers, so it cannot hold a secret to present here.
                        .requestMatchers(HttpMethod.GET, "/api/v1/fires/active", "/api/v1/fires/stream").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/fires/daily-counts").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/air-quality/**").permitAll()
                        // Read-only alert feed the dashboard renders; writes stay protected.
                        .requestMatchers(HttpMethod.GET, "/api/alerts").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/zones/risk").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/burn-severity").permitAll()
                        // The dashboard needs escape routes for whoever is looking at it,
                        // and it cannot hold a secret to ask for them.
                        .requestMatchers(HttpMethod.GET, "/api/evacuation/routes").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        // Not proxied by nginx, so only reachable from the Docker network.
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/prometheus").permitAll()
                        .anyRequest().hasAuthority(ApiKeyAuthFilter.ROLE));
        return http.build();
    }

    /**
     * Same list WebConfig reads for the Vite dev server. Empty (the nginx same-origin
     * setup, Compose and until now Azure) means no Origin header is ever cross-origin to
     * begin with, so this stays a no-op rather than blocking anything.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${wiser.cors.allowed-origins:}") String allowedOriginsProp) {
        CorsConfiguration configuration = new CorsConfiguration();
        if (!allowedOriginsProp.isBlank()) {
            configuration.setAllowedOrigins(List.of(allowedOriginsProp.split("\\s*,\\s*")));
        }
        configuration.setAllowedMethods(List.of("GET", "POST"));
        configuration.setAllowedHeaders(List.of("Content-Type", ApiKeyAuthFilter.HEADER));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}
