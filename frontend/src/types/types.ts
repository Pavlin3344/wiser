import type { Feature, FeatureCollection, Point, LineString, Polygon } from "geojson"

// ─── Theme ───────────────────────────────────────────────────────────────────
export type Theme = "light" | "dark" | "system"

// ─── Risk Level ──────────────────────────────────────────────────────────────
export type RiskLevel = "Low" | "Moderate" | "High" | "Critical"

// ─── Sidebar Tab ─────────────────────────────────────────────────────────────
export type SidebarTab = "risk" | "detection" | "analysis" | "alerts"

// ─── FWI ─────────────────────────────────────────────────────────────────────
/** Numeric Fire Weather Index class (matches backend/message-contracts.md §2). */
export type FWIClass = 1 | 2 | 3 | 4 | 5 | 6

export interface FWIPoint {
  lat: number
  lon: number
  fwi: number
  fwi_class: FWIClass
}

// ─── Fires ───────────────────────────────────────────────────────────────────
export interface FireProperties {
  title: string
  intensity: "moderate" | "high" | "critical"
  date: string // ISO-8601
  frp?: number // Fire Radiative Power (MW)
  source?: string
  confidence?: number
}

export type FireFeature = Feature<Point, FireProperties>
export type FireFeatureCollection = FeatureCollection<Point, FireProperties>

// ─── Evacuation ──────────────────────────────────────────────────────────────
export interface EvacRouteProperties {
  routeName: string
  status: "open" | "closed" | "unknown"
}

export type EvacRoute = Feature<LineString, EvacRouteProperties>
export type EvacRouteCollection = FeatureCollection<LineString, EvacRouteProperties>

// ─── Risk Zones ──────────────────────────────────────────────────────────────
/**
 * Wiser's own risk model, one cell per FWI grid point. Field names are camelCase
 * because that is what the JPA entity serialises - the snake_case column names of
 * the `zones` table never reach the wire.
 *
 * NDVI and fuel are nullable: a cell outside the raster coverage still gets a risk
 * class from FWI alone, and saying so is better than implying a measurement.
 */
export interface RiskZoneProperties {
  id: number
  fwiClass: FWIClass
  fwiValue: number
  ndviMean: number | null
  fuelType: number | null
  riskClass: FWIClass
  riskScore: number
  computedAt: string // ISO-8601
  validDate: string  // YYYY-MM-DD
}

export type RiskZone = Feature<Polygon, RiskZoneProperties>
export type RiskZoneCollection = FeatureCollection<Polygon, RiskZoneProperties>
