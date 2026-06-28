import { useEffect, useRef, type RefObject } from "react"
import maplibregl from "maplibre-gl"
import type { FeatureCollection } from "geojson"
import { generateDynamicWindVectors } from "@/lib/wind-generator"
import { useMapStore } from "@/store/use-map-store"

const FRAME_INTERVAL_MS = 41

/**
 * Drives the animated wind-vector layer.
 * The RAF loop runs only while showWind is true; it self-cancels otherwise.
 */
export function useWindAnimation(mapRef: RefObject<maplibregl.Map | null>): void {
  const showWind = useMapStore((s) => s.showWind)

  const phaseRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)

  useEffect(() => {
    if (!showWind) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    const animate = (timestamp: number) => {
      rafRef.current = requestAnimationFrame(animate)

      if (timestamp - lastFrameRef.current < FRAME_INTERVAL_MS) return
      lastFrameRef.current = timestamp

      const map = mapRef.current
      if (!map) return

      phaseRef.current += 1
      const { currentTime } = useMapStore.getState()
      const windData = generateDynamicWindVectors(map.getBounds(), map.getZoom(), currentTime, phaseRef.current) as FeatureCollection

      if (!map.getSource("wind-vectors")) {
        map.addSource("wind-vectors", { type: "geojson", data: windData })
        map.addLayer({
          id: "wind-vectors-symbol",
          type: "symbol",
          source: "wind-vectors",
          layout: {
            "text-field": "↑",
            "text-rotate": ["get", "direction"],
            "text-size": ["interpolate", ["linear"], ["get", "speed"], 5, 12, 40, 24],
            "text-allow-overlap": false,
            "text-ignore-placement": false,
          },
          paint: {
            "text-color": "#38bdf8",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1,
            "text-opacity": ["get", "opacity"],
          },
        })
      } else {
        ;(map.getSource("wind-vectors") as maplibregl.GeoJSONSource).setData(windData)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [showWind, mapRef])
}
