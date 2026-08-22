package com.wisertech.api;

import java.time.Instant;
import java.time.LocalDate;

import org.locationtech.jts.geom.Polygon;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import tools.jackson.databind.annotation.JsonSerialize;

/**
 * One post-fire burn severity analysis (dNBR), written by data/processing/dnbr.
 *
 * The raster itself stays in MinIO; this row is the summary, so the dashboard can show
 * how much burned and how badly without anyone parsing a GeoTIFF in the browser.
 *
 * Read-only from the API's side - the worker owns these rows.
 */
@Entity
@Table(name = "burn_severity")
public class BurnSeverity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "fire_id")
    private Long fireId;

    private Polygon geom;

    @Column(name = "pre_date")
    private LocalDate preDate;

    @Column(name = "post_date")
    private LocalDate postDate;

    /** Key in the MinIO `processed-products` bucket, not a URL. */
    @Column(name = "raster_path")
    private String rasterPath;

    @Column(name = "mean_dnbr")
    private Double meanDnbr;

    @Column(name = "burned_hectares")
    private Double burnedHectares;

    @Column(name = "analysed_hectares")
    private Double analysedHectares;

    @Column(name = "ha_regrowth")
    private Double haRegrowth;

    @Column(name = "ha_unburned")
    private Double haUnburned;

    @Column(name = "ha_low")
    private Double haLow;

    @Column(name = "ha_moderate_low")
    private Double haModerateLow;

    @Column(name = "ha_moderate_high")
    private Double haModerateHigh;

    @Column(name = "ha_high")
    private Double haHigh;

    @Column(name = "computed_at")
    private Instant computedAt;

    public Integer getId() {
        return id;
    }

    public Long getFireId() {
        return fireId;
    }

    @JsonSerialize(using = PolygonSerializer.class)
    public Polygon getGeom() {
        return geom;
    }

    public LocalDate getPreDate() {
        return preDate;
    }

    public LocalDate getPostDate() {
        return postDate;
    }

    public String getRasterPath() {
        return rasterPath;
    }

    public Double getMeanDnbr() {
        return meanDnbr;
    }

    public Double getBurnedHectares() {
        return burnedHectares;
    }

    public Double getAnalysedHectares() {
        return analysedHectares;
    }

    public Double getHaRegrowth() {
        return haRegrowth;
    }

    public Double getHaUnburned() {
        return haUnburned;
    }

    public Double getHaLow() {
        return haLow;
    }

    public Double getHaModerateLow() {
        return haModerateLow;
    }

    public Double getHaModerateHigh() {
        return haModerateHigh;
    }

    public Double getHaHigh() {
        return haHigh;
    }

    public Instant getComputedAt() {
        return computedAt;
    }
}
