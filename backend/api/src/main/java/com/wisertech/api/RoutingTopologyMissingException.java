package com.wisertech.api;

/**
 * The roads table is present but has no pgRouting topology. Populating it is a
 * documented manual osm2pgrouting import (db/postgres/scripts/README.md), so this
 * is an operator action rather than a server fault.
 */
public class RoutingTopologyMissingException extends RuntimeException {
    public RoutingTopologyMissingException(String message) {
        super(message);
    }
}
