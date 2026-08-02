package com.wisertech.api;

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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(RoadController.class)
class RoadControllerTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RoadRepository roadRepository;

    @Test
    void getRoads_returnsListWithGeoJsonGeometry() throws Exception {
        // Road has no setters at all (not even geom) - ReflectionTestUtils populates this
        // fixture rather than adding a setter that would exist purely for tests.
        Road road = new Road();
        ReflectionTestUtils.setField(road, "highway", "residential");
        ReflectionTestUtils.setField(road, "passable", true);
        ReflectionTestUtils.setField(road, "geom", GEOMETRY_FACTORY.createLineString(new Coordinate[] {
                new Coordinate(23.30, 42.70), new Coordinate(23.32, 42.72)
        }));
        when(roadRepository.findAll()).thenReturn(List.of(road));

        mockMvc.perform(get("/api/roads"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].highway").value("residential"))
                .andExpect(jsonPath("$[0].passable").value(true))
                .andExpect(jsonPath("$[0].geom.type").value("LineString"))
                .andExpect(jsonPath("$[0].geom.coordinates[0][0]").value(23.30));
    }
}
