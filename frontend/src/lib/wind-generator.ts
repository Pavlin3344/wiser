import type maplibregl from "maplibre-gl"
import type { Feature, FeatureCollection, Point } from "geojson"

interface WindProperties {
  direction: number
  speed: number
  opacity: number
}

/**
 * Generates wind vectors using a flow-field algorithm.
 * Optimized with pre-calculated constants and explicit typing.
 */
export function generateDynamicWindVectors(bounds: maplibregl.LngLatBounds, zoom: number, time: number, phase: number): FeatureCollection<Point, WindProperties> {
  const step = zoom > 8 ? 0.2 : zoom > 5 ? 0.5 : 1.5

  const minLng = Math.floor(bounds.getWest() / step) * step
  const maxLng = Math.ceil(bounds.getEast() / step) * step
  const minLat = Math.floor(bounds.getSouth() / step) * step
  const maxLat = Math.ceil(bounds.getNorth() / step) * step

  const features: Feature<Point, WindProperties>[] = []

  for (let lng = minLng; lng <= maxLng; lng += step) {
    const lngFactor = lng * 0.5
    for (let lat = minLat; lat <= maxLat; lat += step) {
      const timeFactor = time * 0.2
      const angle = (Math.sin(lngFactor + timeFactor) * Math.cos(lat * 0.5 - timeFactor) + 1) * 180
      const speed = Math.abs(Math.sin(lng + lat + time * 0.5) * 35) + 5

      const fraction = ((phase * speed * 0.05) % 100) / 100

      const angleRad = angle * (Math.PI / 180)
      const offsetLng = lng + Math.sin(angleRad) * step * fraction
      const offsetLat = lat + Math.cos(angleRad) * step * fraction

      const opacity = Math.sin(fraction * Math.PI)

      features.push({
        type: "Feature",
        properties: {
          direction: angle,
          speed,
          opacity,
        },
        geometry: {
          type: "Point",
          coordinates: [offsetLng, offsetLat],
        },
      })
    }
  }

  return { type: "FeatureCollection", features }
}
