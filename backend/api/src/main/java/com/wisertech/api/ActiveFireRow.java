package com.wisertech.api;

import java.time.Instant;

/**
 * One row read straight out of the active_fires table.
 * geometryJson / propertiesJson are already JSON text (Postgres did the
 * conversion), so the controller just parses and re-embeds them.
 */
record ActiveFireRow(
    long id,
    String source,
    Instant detectedAt,
    Integer confidence,
    Double frp,
    String geometryJson,
    String propertiesJson
) {}
