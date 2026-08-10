package com.wisertech.api;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ZoneController.class)
class ZoneControllerTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ZoneRepository zoneRepository;

    @Test
    void getRiskZones_returnsListWithGeoJsonPolygon() throws Exception {
        Polygon geom = GEOMETRY_FACTORY.createPolygon(GEOMETRY_FACTORY.createLinearRing(new Coordinate[] {
                new Coordinate(23.0, 42.0), new Coordinate(23.1, 42.0),
                new Coordinate(23.1, 42.1), new Coordinate(23.0, 42.1), new Coordinate(23.0, 42.0)
        }));
        Zone zone = new Zone();
        zone.setGeom(geom);
        zone.setRiskClass((short) 5);
        when(zoneRepository.findAll()).thenReturn(List.of(zone));

        mockMvc.perform(get("/zones/risk"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].riskClass").value(5))
                .andExpect(jsonPath("$[0].geom.type").value("Polygon"))
                .andExpect(jsonPath("$[0].geom.coordinates[0][0][0]").value(23.0));
    }
}
