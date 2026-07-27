package com.wisertech.ingestion;

import java.util.List;

public record OverpassResponse(List<OverpassElement> elements) {
}
