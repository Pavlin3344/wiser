package com.wisertech.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CriticalInfrastructureController.class)
class CriticalInfrastructureControllerTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CriticalInfrastructureRepository criticalInfrastructureRepository;

    @Test
    void getCriticalInfrastructure_returnsListWithGeoJsonGeometry() throws Exception {
        // CriticalInfrastructure (api's copy) is read-only - api only ever reads what
        // ingestion's OSM importer wrote - so ReflectionTestUtils populates this fixture.
        CriticalInfrastructure infra = new CriticalInfrastructure();
        ReflectionTestUtils.setField(infra, "name", "Test Hospital");
        ReflectionTestUtils.setField(infra, "type", "hospital");
        ReflectionTestUtils.setField(infra, "geom", GEOMETRY_FACTORY.createPoint(new Coordinate(23.32, 42.70)));
        when(criticalInfrastructureRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(infra)));

        mockMvc.perform(get("/api/critical-infrastructure"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("Test Hospital"))
                .andExpect(jsonPath("$.content[0].type").value("hospital"))
                .andExpect(jsonPath("$.content[0].geom.type").value("Point"))
                .andExpect(jsonPath("$.content[0].geom.coordinates[0]").value(23.32));
    }
}
