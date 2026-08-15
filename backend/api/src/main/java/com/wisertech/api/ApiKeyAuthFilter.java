package com.wisertech.api;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class ApiKeyAuthFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-API-Key";
    public static final String ROLE = "ROLE_SERVICE";

    private final byte[] expectedKey;

    public ApiKeyAuthFilter(String apiKey) {
        this.expectedKey = apiKey == null ? new byte[0] : apiKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String presented = request.getHeader(HEADER);
        if (presented != null && matches(presented)) {
            var auth = new UsernamePasswordAuthenticationToken(
                    "api-key", null, List.of(new SimpleGrantedAuthority(ROLE)));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(request, response);
    }

    // An unset key must never authenticate anyone, otherwise a missing env var silently
    // opens every protected endpoint.
    private boolean matches(String presented) {
        if (expectedKey.length == 0) {
            return false;
        }
        return MessageDigest.isEqual(expectedKey, presented.getBytes(StandardCharsets.UTF_8));
    }
}
