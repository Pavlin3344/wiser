package com.wisertech.api;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.LineString;

import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

public class LineStringSerializer extends ValueSerializer<LineString> {
    @Override
    public void serialize(LineString value, JsonGenerator gen, SerializationContext ctxt) throws JacksonException {
        gen.writeStartObject();
        gen.writeStringProperty("type", "LineString");
        gen.writeName("coordinates");
        gen.writeStartArray();
        for (Coordinate coordinate : value.getCoordinates()) {
            gen.writeStartArray();
            gen.writeNumber(coordinate.getX());
            gen.writeNumber(coordinate.getY());
            gen.writeEndArray();
        }
        gen.writeEndArray();
        gen.writeEndObject();
    }
}
