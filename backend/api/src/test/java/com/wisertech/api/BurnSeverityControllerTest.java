package com.wisertech.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.Limit;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(BurnSeverityController.class)
class BurnSeverityControllerTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private BurnSeverityRepository burnSeverityRepository;

    // The worker owns these rows, so the entity is read-only and has no setters.
    private BurnSeverity analysis() {
        Polygon geom = GEOMETRY_FACTORY.createPolygon(GEOMETRY_FACTORY.createLinearRing(new Coordinate[] {
                new Coordinate(23.0, 42.0), new Coordinate(23.1, 42.0),
                new Coordinate(23.1, 42.1), new Coordinate(23.0, 42.1), new Coordinate(23.0, 42.0)
        }));
        BurnSeverity analysis = new BurnSeverity();
        ReflectionTestUtils.setField(analysis, "geom", geom);
        ReflectionTestUtils.setField(analysis, "fireId", 42L);
        ReflectionTestUtils.setField(analysis, "preDate", LocalDate.of(2026, 7, 1));
        ReflectionTestUtils.setField(analysis, "postDate", LocalDate.of(2026, 7, 20));
        ReflectionTestUtils.setField(analysis, "meanDnbr", 0.42);
        ReflectionTestUtils.setField(analysis, "burnedHectares", 128.5);
        ReflectionTestUtils.setField(analysis, "haHigh", 12.25);
        ReflectionTestUtils.setField(analysis, "rasterPath", "dnbr/2026-07-20/T34TGN.tif");
        return analysis;
    }

    @Test
    void getBurnSeverity_returnsSummaryWithGeoJsonPolygon() throws Exception {
        when(burnSeverityRepository.findAllByOrderByPostDateDescComputedAtDesc(any(Limit.class)))
                .thenReturn(List.of(analysis()));

        mockMvc.perform(get("/api/burn-severity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fireId").value(42))
                .andExpect(jsonPath("$[0].meanDnbr").value(0.42))
                .andExpect(jsonPath("$[0].burnedHectares").value(128.5))
                .andExpect(jsonPath("$[0].haHigh").value(12.25))
                .andExpect(jsonPath("$[0].postDate").value("2026-07-20"))
                .andExpect(jsonPath("$[0].geom.type").value("Polygon"))
                .andExpect(jsonPath("$[0].geom.coordinates[0][0][0]").value(23.0));
    }

    /** An unbounded response would grow with every fire the system ever analyses. */
    @Test
    void getBurnSeverity_capsAnOverlyLargeLimit() throws Exception {
        when(burnSeverityRepository.findAllByOrderByPostDateDescComputedAtDesc(any(Limit.class)))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/burn-severity?limit=5000")).andExpect(status().isOk());

        ArgumentCaptor<Limit> captor = ArgumentCaptor.forClass(Limit.class);
        verify(burnSeverityRepository).findAllByOrderByPostDateDescComputedAtDesc(captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().max()).isEqualTo(100);
    }

    @Test
    void getBurnSeverity_defaultsToTwenty() throws Exception {
        when(burnSeverityRepository.findAllByOrderByPostDateDescComputedAtDesc(any(Limit.class)))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/burn-severity")).andExpect(status().isOk());

        ArgumentCaptor<Limit> captor = ArgumentCaptor.forClass(Limit.class);
        verify(burnSeverityRepository).findAllByOrderByPostDateDescComputedAtDesc(captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().max()).isEqualTo(20);
    }
}
