import type { Feature, FeatureCollection, Point, LineString, Polygon } from "geojson"

// ─── Theme ───────────────────────────────────────────────────────────────────
export type Theme = "light" | "dark" | "system"

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
/** Matches the `zones` table in db/postgres/migrations. */
export interface RiskZoneProperties {
  id: number
  fwi_class: FWIClass
  fwi_value: number
  ndvi_mean: number
  risk_class: FWIClass
  risk_score: number
  computed_at: string // ISO-8601
  valid_date: string  // YYYY-MM-DD
}

export type RiskZone = Feature<Polygon, RiskZoneProperties>
export type RiskZoneCollection = FeatureCollection<Polygon, RiskZoneProperties>
