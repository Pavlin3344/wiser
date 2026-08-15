package com.wisertech.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ActiveFireController.class)
class ActiveFireControllerTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ActiveFireRepository activeFireRepository;

    @Test
    void getActiveFires_returnsListWithGeoJsonGeometry() throws Exception {
        Point geom = GEOMETRY_FACTORY.createPoint(new Coordinate(23.32, 42.70));
        ActiveFire fire = new ActiveFire("MODIS_NRT", Instant.parse("2026-08-01T12:00:00Z"), (short) 80, 15.0);
        fire.setGeom(geom);
        when(activeFireRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(fire)));

        mockMvc.perform(get("/api/active-fires"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.content[0].source").value("MODIS_NRT"))
                .andExpect(jsonPath("$.content[0].confidence").value(80))
                .andExpect(jsonPath("$.content[0].geom.type").value("Point"))
                .andExpect(jsonPath("$.content[0].geom.coordinates[0]").value(23.32))
                .andExpect(jsonPath("$.content[0].geom.coordinates[1]").value(42.70));
    }

    @Test
    void postActiveFire_rejectsOutOfRangeCoordinates() throws Exception {
        String requestBody = """
                {
                  "source": "MODIS_NRT",
                  "detectedAt": "2026-08-01T12:00:00Z",
                  "latitude": 999.0,
                  "longitude": 23.32
                }
                """;

        mockMvc.perform(post("/api/active-fires")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("validation_failed"))
                .andExpect(jsonPath("$.fields.latitude").exists());

        verify(activeFireRepository, never()).save(any(ActiveFire.class));
    }

    @Test
    void postActiveFire_buildsPointFromLatLonAndSaves() throws Exception {
        when(activeFireRepository.save(any(ActiveFire.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String requestBody = """
                {
                  "source": "MODIS_NRT",
                  "detectedAt": "2026-08-01T12:00:00Z",
                  "confidence": 80,
                  "frp": 15.0,
                  "latitude": 42.70,
                  "longitude": 23.32
                }
                """;

        mockMvc.perform(post("/api/active-fires")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.geom.type").value("Point"))
                .andExpect(jsonPath("$.geom.coordinates[0]").value(23.32))
                .andExpect(jsonPath("$.geom.coordinates[1]").value(42.70));

        verify(activeFireRepository).save(any(ActiveFire.class));
    }
}
