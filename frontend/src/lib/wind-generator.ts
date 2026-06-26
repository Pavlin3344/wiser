import type maplibregl from "maplibre-gl"
import type { Feature, FeatureCollection, Point } from "geojson"

interface WindProperties {
  direction: number
  speed: number
}

/**
 * Generates wind vectors using a flow-field algorithm.
 * Optimized with pre-calculated constants and explicit typing.
 */
export function generateDynamicWindVectors(bounds: maplibregl.LngLatBounds, zoom: number): FeatureCollection<Point> {
  const step = zoom > 8 ? 0.2 : zoom > 5 ? 0.5 : 1.5

  const minLng = Math.floor(bounds.getWest() / step) * step
  const maxLng = Math.ceil(bounds.getEast() / step) * step
  const minLat = Math.floor(bounds.getSouth() / step) * step
  const maxLat = Math.ceil(bounds.getNorth() / step) * step

  const features: Feature<Point, WindProperties>[] = []

  for (let lng = minLng; lng <= maxLng; lng += step) {
    const lngFactor = lng * 0.5
    for (let lat = minLat; lat <= maxLat; lat += step) {
      const angle = (Math.sin(lngFactor) * Math.cos(lat * 0.5) + 1) * 180
      const speed = Math.abs(Math.sin(lng + lat) * 35) + 5

      features.push({
        type: "Feature",
        properties: {
          direction: angle,
          speed,
        },
        geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
      })
    }
  }

  return { type: "FeatureCollection", features }
}
