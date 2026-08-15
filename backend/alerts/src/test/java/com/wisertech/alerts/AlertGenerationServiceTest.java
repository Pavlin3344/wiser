package com.wisertech.alerts;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

// Pure logic, no Spring context or database needed - just the distance-to-severity mapping.
// severityFor is package-private (not private) specifically so this can call it directly
// instead of mocking three repositories to reach it through generateAlerts().
class AlertGenerationServiceTest {

    private final AlertGenerationService service = new AlertGenerationService(null, null, null, null, 5000.0);

    @ParameterizedTest(name = "{0}m -> {1}")
    @CsvSource({
            "0,       critical",
            "999.9,   critical",
            // Boundary: exactly 1000m is NOT critical (condition is strictly "< 1000").
            // This is the line a reviewer is most likely to ask about.
            "1000,    high",
            "1000.1,  high",
            "2499.9,  high",
            // Same boundary shape at the high/medium line: exactly 2500m is NOT high.
            "2500,    medium",
            "10000,   medium"
    })
    void severityFor_appliesDistanceBoundariesCorrectly(double meters, String expectedSeverity) {
        assertThat(service.severityFor(meters)).isEqualTo(expectedSeverity);
    }
}
