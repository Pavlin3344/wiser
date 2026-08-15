package com.wisertech.ingestion;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

class FirmsFireDetectionProviderTest {

    private FirmsFireDetectionProvider provider() {
        return new FirmsFireDetectionProvider("real-key", "22.3,41.2,28.7,44.2", new SimpleMeterRegistry());
    }

    // VIIRS grades confidence l/n/h while MODIS reports a percentage. Parsing the VIIRS
    // letter with Short.parseShort would throw and lose the whole feed.
    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
            "l, 30",
            "n, 70",
            "h, 95",
            "L, 30",
            "high, 95",
            "0, 0",
            "82, 82",
            "100, 100",
    })
    void parsesBothConfidenceFormats(String raw, short expected) {
        assertThat(FirmsFireDetectionProvider.parseConfidence(raw)).isEqualTo(expected);
    }

    @Test
    void parsesModisRowsWithNumericConfidence() {
        String csv = """
                latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
                42.70,23.32,330.1,1.0,1.0,2026-08-15,1210,Aqua,MODIS,82,6.1NRT,290.0,15.5,D
                """;

        List<ActiveFire> detections = provider().parseCsv(csv, "MODIS_NRT");

        assertThat(detections).hasSize(1);
        ActiveFire fire = detections.getFirst();
        assertThat(fire.getSource()).isEqualTo("MODIS_NRT");
        assertThat(fire.getConfidence()).isEqualTo((short) 82);
        assertThat(fire.getFrp()).isEqualTo(15.5);
        assertThat(fire.getDetectedAt()).isEqualTo(Instant.parse("2026-08-15T12:10:00Z"));
        assertThat(fire.getGeom().getX()).isEqualTo(23.32);
        assertThat(fire.getGeom().getY()).isEqualTo(42.70);
    }

    @Test
    void parsesViirsRowsWithLetterConfidence() {
        String csv = """
                latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
                42.15,24.75,340.2,0.4,0.4,2026-08-15,0930,N,VIIRS,n,2.0NRT,295.1,8.2,D
                """;

        List<ActiveFire> detections = provider().parseCsv(csv, "VIIRS_SNPP_NRT");

        assertThat(detections).hasSize(1);
        ActiveFire fire = detections.getFirst();
        assertThat(fire.getSource()).isEqualTo("VIIRS_SNPP_NRT");
        assertThat(fire.getConfidence()).isEqualTo((short) 70);
        assertThat(fire.getFrp()).isEqualTo(8.2);
    }

    @Test
    void ignoresBlankTrailingLines() {
        String csv = """
                latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
                42.70,23.32,330.1,1.0,1.0,2026-08-15,1210,Aqua,MODIS,82,6.1NRT,290.0,15.5,D

                """;

        assertThat(provider().parseCsv(csv, "MODIS_NRT")).hasSize(1);
    }

    @Test
    void headerOnlyResponseYieldsNoDetections() {
        String csv = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n";

        assertThat(provider().parseCsv(csv, "MODIS_NRT")).isEmpty();
    }
}
