import type { Polygon } from "geojson"
import { API_BASE_URL } from "@/lib/api"

/**
 * One completed post-fire analysis, as the API serialises the `burn_severity` row.
 *
 * Hectares are split by severity class; `burnedHectares` is the sum of the classes
 * that actually burned (low through high), not of everything analysed. Every measure
 * is nullable because a scene can be analysed and still produce no value for a class.
 */
export interface BurnSeverityAnalysis {
  id: number
  fireId: number | null
  geom: Polygon | null
  preDate: string
  postDate: string
  /** Key inside the MinIO `processed-products` bucket, not a URL. */
  rasterPath: string
  meanDnbr: number | null
  burnedHectares: number | null
  analysedHectares: number | null
  haRegrowth: number | null
  haUnburned: number | null
  haLow: number | null
  haModerateLow: number | null
  haModerateHigh: number | null
  haHigh: number | null
  computedAt: string
}

/** Completed dNBR analyses, most recently burned first. */
export async function fetchBurnSeverity(limit = 20): Promise<BurnSeverityAnalysis[]> {
  const res = await fetch(`${API_BASE_URL}/api/burn-severity?limit=${limit}`)
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`)
  }
  return res.json() as Promise<BurnSeverityAnalysis[]>
}
