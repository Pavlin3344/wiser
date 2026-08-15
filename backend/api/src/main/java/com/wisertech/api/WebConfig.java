package com.wisertech.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * In production nginx proxies the SPA and the API under one origin, so no CORS
 * headers are needed. This exists for the Vite dev server, which runs on its own port.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;

    public WebConfig(@Value("${wiser.cors.allowed-origins:}") String allowedOrigins) {
        this.allowedOrigins = allowedOrigins.isBlank() ? new String[0] : allowedOrigins.split("\\s*,\\s*");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        if (allowedOrigins.length == 0) {
            return;
        }
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST")
                .allowedHeaders("Content-Type", ApiKeyAuthFilter.HEADER);
    }
}
