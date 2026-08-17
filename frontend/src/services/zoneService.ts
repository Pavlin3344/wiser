import type { Polygon } from "geojson"
import type { RiskZoneCollection, RiskZoneProperties } from "@/types/types"

/** One row of the `zones` table as the API serialises it. */
interface ZoneRow extends RiskZoneProperties {
  geom: Polygon | null
}

/**
 * Wiser's own risk zones for the most recently computed day.
 *
 * The endpoint returns table rows with a geometry field rather than a GeoJSON
 * FeatureCollection, so the shape MapLibre needs is assembled here instead of
 * being rebuilt at every call site.
 */
export async function fetchRiskZones(): Promise<RiskZoneCollection> {
  const res = await fetch("/api/zones/risk")
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`)
  }

  const rows = (await res.json()) as ZoneRow[]

  return {
    type: "FeatureCollection",
    features: rows
      // A row whose geometry failed to serialise is dropped rather than drawn at
      // null island, which would put a risk cell in the Gulf of Guinea.
      .filter((row) => row.geom !== null)
      .map(({ geom, ...properties }) => ({
        type: "Feature" as const,
        geometry: geom as Polygon,
        properties,
      })),
  }
}
