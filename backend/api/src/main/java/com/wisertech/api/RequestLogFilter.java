package com.wisertech.api;

import static net.logstash.logback.argument.StructuredArguments.kv;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * One log line per request.
 *
 * <p>Spring Boot logs nothing per request by default, and this service handles what the map
 * actually shows - so in three days of production the whole api produced one line in Kibana:
 * a Jackson warning. The service was working; it simply had nothing to say. "No logs" and
 * "not running" looked identical, on the one component where the difference matters most.
 *
 * <p>The fields go out under {@code http}, the same shape the nginx access log is parsed into
 * (infra/docker/logstash/pipeline/wiser.conf). One filter in Kibana - {@code http.status >=
 * 500} - then covers the edge and the API together, rather than each needing its own query.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLogFilter extends OncePerRequestFilter {

    private static final Logger LOG = LoggerFactory.getLogger(RequestLogFilter.class);

    /**
     * Container Apps calls the liveness and readiness probes every few seconds, forever.
     * Logging those would bury the real traffic under roughly seventeen thousand lines a day
     * that say nothing but "still up" - which Prometheus already says, more cheaply.
     * A probe that <em>fails</em> is a different matter and still gets logged below.
     */
    private static final String PROBE_PREFIX = "/actuator/";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {

        long startedNanos = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            // In a finally block, and deliberately: an exception on the way out still
            // produced a response, and that is exactly the request worth having a line for.
            // Ordered first in the chain so this also sees what Spring Security rejects -
            // a 403 nobody expected is a support call, and it never reaches a controller.
            int status = response.getStatus();
            String path = request.getRequestURI();

            // No early return from a finally block: it would discard an exception thrown by
            // the chain, and a logging filter must never change what the caller sees.
            if (status >= 400 || !path.startsWith(PROBE_PREFIX)) {
                long millis = (System.nanoTime() - startedNanos) / 1_000_000;

                // LinkedHashMap, not Map.of: the field order is what a person reads in the
                // console appender, and Map.of does not keep one.
                Map<String, Object> http = new LinkedHashMap<>();
                http.put("method", request.getMethod());
                http.put("path", path);
                http.put("status", status);
                http.put("duration_ms", millis);
                String query = request.getQueryString();
                if (query != null) {
                    http.put("query", query);
                }

                String summary = "{} {} {} {}ms";
                if (status >= 500) {
                    LOG.error(summary, request.getMethod(), path, status, millis, kv("http", http));
                } else if (status >= 400) {
                    LOG.warn(summary, request.getMethod(), path, status, millis, kv("http", http));
                } else {
                    LOG.info(summary, request.getMethod(), path, status, millis, kv("http", http));
                }
            }
        }
    }
}
