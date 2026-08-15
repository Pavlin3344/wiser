package com.wisertech.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import jakarta.servlet.FilterChain;

class ApiKeyAuthFilterTest {

    private final FilterChain chain = mock(FilterChain.class);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void runFilter(String configuredKey, String presentedKey) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (presentedKey != null) {
            request.addHeader(ApiKeyAuthFilter.HEADER, presentedKey);
        }
        new ApiKeyAuthFilter(configuredKey).doFilter(request, new MockHttpServletResponse(), chain);
    }

    @Test
    void authenticatesWhenKeyMatches() throws Exception {
        runFilter("s3cret", "s3cret");

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        verify(chain).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void doesNotAuthenticateOnWrongKey() throws Exception {
        runFilter("s3cret", "guess");

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void doesNotAuthenticateWhenHeaderMissing() throws Exception {
        runFilter("s3cret", null);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    // The important one: an unset WISER_API_KEY must not turn into "everyone is
    // authenticated", which is how a missing env var silently opens the whole API.
    @Test
    void unconfiguredKeyRejectsEvenAnEmptyHeader() throws Exception {
        runFilter("", "");

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
