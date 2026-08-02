package com.wisertech.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LinearRing;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.geom.PrecisionModel;

import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.module.SimpleModule;

class PolygonSerializerTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);
    private final JsonMapper mapper = JsonMapper.builder()
            .addModule(new SimpleModule().addSerializer(Polygon.class, new PolygonSerializer()))
            .build();

    private static LinearRing ring(double... coords) {
        Coordinate[] points = new Coordinate[coords.length / 2];
        for (int i = 0; i < points.length; i++) {
            points[i] = new Coordinate(coords[i * 2], coords[i * 2 + 1]);
        }
        return GEOMETRY_FACTORY.createLinearRing(points);
    }

    @Test
    void serializesPolygonAsGeoJson() {
        LinearRing shell = ring(23.0, 42.0, 23.1, 42.0, 23.1, 42.1, 23.0, 42.1, 23.0, 42.0);
        Polygon polygon = GEOMETRY_FACTORY.createPolygon(shell);

        String json = mapper.writeValueAsString(polygon);

        assertThat(json).isEqualTo(
                "{\"type\":\"Polygon\",\"coordinates\":[[[23.0,42.0],[23.1,42.0],[23.1,42.1],[23.0,42.1],[23.0,42.0]]]}");
    }

    @Test
    void serializesOnlyTheExteriorRing_holesAreSilentlyDropped() {
        LinearRing shell = ring(23.0, 42.0, 23.1, 42.0, 23.1, 42.1, 23.0, 42.1, 23.0, 42.0);
        LinearRing hole = ring(23.02, 42.02, 23.08, 42.02, 23.08, 42.08, 23.02, 42.08, 23.02, 42.02);
        Polygon polygonWithHole = GEOMETRY_FACTORY.createPolygon(shell, new LinearRing[] { hole });

        String json = mapper.writeValueAsString(polygonWithHole);

        // Documents a known, accepted simplification: the "coordinates" array has exactly one
        // ring (the shell). A GeoJSON-correct polygon with a hole would have two. If this
        // entity ever needs to represent zones with holes, PolygonSerializer needs updating -
        // this test is what should fail first to point at that.
        assertThat(json).isEqualTo(
                "{\"type\":\"Polygon\",\"coordinates\":[[[23.0,42.0],[23.1,42.0],[23.1,42.1],[23.0,42.1],[23.0,42.0]]]}");
    }
}
