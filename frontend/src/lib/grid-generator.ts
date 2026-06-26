import type maplibregl from "maplibre-gl"
import type { FeatureCollection, Polygon } from "geojson"

export function generateDynamicRiskGrid(bounds: maplibregl.LngLatBounds, zoom: number, filterLevel: string, time: number): FeatureCollection<Polygon> {
  let latStep = 4
  if (zoom > 4) latStep = 1
  if (zoom > 6) latStep = 0.25
  if (zoom > 8) latStep = 0.1
  if (zoom > 10) latStep = 0.025
  if (zoom > 12) latStep = 0.005
  if (zoom > 14) latStep = 0.001

  const centerLat = (bounds.getNorth() + bounds.getSouth()) / 2

  const lngStep = latStep / Math.cos(centerLat * (Math.PI / 180))

  const minLng = Math.floor(bounds.getWest() / lngStep) * lngStep
  const maxLng = Math.ceil(bounds.getEast() / lngStep) * lngStep
  const minLat = Math.floor(bounds.getSouth() / latStep) * latStep
  const maxLat = Math.ceil(bounds.getNorth() / latStep) * latStep

  const features: GeoJSON.Feature<Polygon>[] = []

  for (let lng = minLng; lng <= maxLng; lng += lngStep) {
    for (let lat = minLat; lat <= maxLat; lat += latStep) {
      const timeFactor = time * 0.1
      const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233 + timeFactor) * 43758.5453)
      const rand = seed - Math.floor(seed)

      let level = "low"
      if (rand > 0.88) level = "high"
      else if (rand > 0.7) level = "moderate"

      if (filterLevel !== "all" && level !== filterLevel) continue

      const sectorId = `SEC-${Math.floor(rand * 9000) + 1000}-${Math.abs(Math.floor(lat * 10))}`
      const baseTemp = level === "high" ? 35 : level === "moderate" ? 25 : 15
      const temp = Math.floor(baseTemp + rand * 12)
      const baseHum = level === "high" ? 10 : level === "moderate" ? 30 : 50
      const humidity = Math.floor(baseHum + rand * 25)

      features.push({
        type: "Feature",
        properties: {
          level,
          sectorId,
          temp,
          humidity,
        },
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
