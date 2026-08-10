package com.wisertech.ingestion;

import java.io.IOException;
import java.util.List;

/**
 * Abstraction over "a source of fire detections", so a second provider
 * (e.g. a different satellite feed) can be added later without touching
 * the ingestion service or the entity it produces.
 */
public interface FireDetectionProvider {
    List<ActiveFire> fetchLatest() throws IOException, InterruptedException;
}
