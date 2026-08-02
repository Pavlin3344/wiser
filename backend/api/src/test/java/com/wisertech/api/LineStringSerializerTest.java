package com.wisertech.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.geom.PrecisionModel;

import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.module.SimpleModule;

class LineStringSerializerTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);
    private final JsonMapper mapper = JsonMapper.builder()
            .addModule(new SimpleModule().addSerializer(LineString.class, new LineStringSerializer()))
            .build();

    @Test
    void serializesLineStringAsGeoJson() {
        LineString line = GEOMETRY_FACTORY.createLineString(new Coordinate[] {
                new Coordinate(23.30, 42.70),
                new Coordinate(23.32, 42.72)
        });

        String json = mapper.writeValueAsString(line);

        assertThat(json).isEqualTo("{\"type\":\"LineString\",\"coordinates\":[[23.3,42.7],[23.32,42.72]]}");
    }
}
