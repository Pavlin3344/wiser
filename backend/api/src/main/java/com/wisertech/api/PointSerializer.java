package com.wisertech.api;

import org.locationtech.jts.geom.Point;

import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

public class PointSerializer extends ValueSerializer<Point> {
    @Override
    public void serialize(Point value, JsonGenerator gen, SerializationContext ctxt) throws JacksonException {
        gen.writeStartObject();
        gen.writeStringProperty("type", "Point");
        gen.writeName("coordinates");
        gen.writeStartArray();
        gen.writeNumber(value.getX());
        gen.writeNumber(value.getY());
        gen.writeEndArray();
        gen.writeEndObject();
    }
}
