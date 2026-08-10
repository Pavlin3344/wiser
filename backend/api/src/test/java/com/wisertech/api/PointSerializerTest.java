package com.wisertech.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;

import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.module.SimpleModule;

class PointSerializerTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);
    private final JsonMapper mapper = JsonMapper.builder()
            .addModule(new SimpleModule().addSerializer(Point.class, new PointSerializer()))
            .build();

    @Test
    void serializesPointAsGeoJson() {
        Point point = GEOMETRY_FACTORY.createPoint(new Coordinate(23.32, 42.7));

        String json = mapper.writeValueAsString(point);

        assertThat(json).isEqualTo("{\"type\":\"Point\",\"coordinates\":[23.32,42.7]}");
    }
}
