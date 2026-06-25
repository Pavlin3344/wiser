import type maplibregl from "maplibre-gl"
import type { FeatureCollection, Polygon } from "geojson"

export function generateDynamicRiskGrid(bounds: maplibregl.LngLatBounds, zoom: number, filterLevel: string): FeatureCollection<Polygon> {
  // 1. Determine the square size based on how far the user is zoomed in
  let latStep = 4 // Zoomed out (Continents) -> 4 degree squares
  if (zoom > 4) latStep = 1 // Countries
  if (zoom > 6) latStep = 0.25 // States/Provinces
  if (zoom > 8) latStep = 0.1 // Counties
  if (zoom > 10) latStep = 0.025 // Cities
  if (zoom > 12) latStep = 0.005 // Neighborhoods
  if (zoom > 14) latStep = 0.001

  // 2. THE FIX: Calculate the screen's center latitude
  const centerLat = (bounds.getNorth() + bounds.getSouth()) / 2

  // 3. Scale the LONGITUDE step using spherical trigonometry (Cosine of Latitude)
  // This forces the grid to render as perfect visual squares on a Web Mercator map!
  const lngStep = latStep / Math.cos(centerLat * (Math.PI / 180))

  // 4. Snap the grid to perfect mathematical intervals so it doesn't "slide" when panning
  const minLng = Math.floor(bounds.getWest() / lngStep) * lngStep
  const maxLng = Math.ceil(bounds.getEast() / lngStep) * lngStep
  const minLat = Math.floor(bounds.getSouth() / latStep) * latStep
  const maxLat = Math.ceil(bounds.getNorth() / latStep) * latStep

  const features: GeoJSON.Feature<Polygon>[] = []

  // 5. Loop through the visible screen and draw the squares
  for (let lng = minLng; lng <= maxLng; lng += lngStep) {
    for (let lat = minLat; lat <= maxLat; lat += latStep) {
      // 6. Stable Pseudo-Random Generator based on Coordinates
      // This ensures that if [24.5, 42.0] is a RED square, it is ALWAYS red,
      // preventing the grid from flickering or changing when you pan the map.
      const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453)
      const rand = seed - Math.floor(seed)

      let level = "low"
      if (rand > 0.88)
        level = "high" // 12% of squares are critical
      else if (rand > 0.7) level = "moderate" // 18% of squares are moderate

      // Apply the user's sidebar filter!
      if (filterLevel !== "all" && level !== filterLevel) continue

      features.push({
        type: "Feature",
        properties: { level },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [lng, lat],
              [lng + lngStep, lat],
              [lng + lngStep, lat + latStep],
              [lng, lat + latStep],
              [lng, lat],
            ],
          ],
        },
      })
    }
  }

  return { type: "FeatureCollection", features }
}
