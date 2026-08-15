package com.wisertech.api;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record EvacuationRouteRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double fromLat,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double fromLng,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double toLat,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double toLng) {
}
