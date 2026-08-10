package com.wisertech.api;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Polygon;

import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

public class PolygonSerializer extends ValueSerializer<Polygon> {
    @Override
    public void serialize(Polygon value, JsonGenerator gen, SerializationContext ctxt) throws JacksonException {
        gen.writeStartObject();
        gen.writeStringProperty("type", "Polygon");
        gen.writeName("coordinates");
        gen.writeStartArray();
        gen.writeStartArray();
        for (Coordinate coordinate : value.getExteriorRing().getCoordinates()) {
            gen.writeStartArray();
            gen.writeNumber(coordinate.getX());
            gen.writeNumber(coordinate.getY());
            gen.writeEndArray();
        }
        gen.writeEndArray();
        gen.writeEndArray();
        gen.writeEndObject();
    }
}
