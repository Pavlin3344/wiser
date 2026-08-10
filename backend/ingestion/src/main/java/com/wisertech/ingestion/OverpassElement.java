package com.wisertech.ingestion;

import java.util.Map;

public record OverpassElement(String type, Long id, Double lat, Double lon, Map<String, String> tags) {
}
