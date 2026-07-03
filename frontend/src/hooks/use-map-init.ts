import { useEffect, useRef, type RefObject } from "react"
import maplibregl, { type StyleSpecification } from "maplibre-gl"
import { useMapStore } from "@/store/use-map-store"
import { useUIStore } from "@/store/use-ui-store"
import { satelliteStyle } from "@/lib/map-config"

const LIGHT_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

export function resolveMapStyle(theme: string, basemap: string): string | StyleSpecification {
  if (basemap === "satellite") return satelliteStyle
  return theme === "dark" ? DARK_STYLE : LIGHT_STYLE
}

/**
 * Creates and tears down the MapLibre instance.
 * Returns a STABLE ref via useRef — consumers should never re-create the map themselves.
 *
 * IMPORTANT: This MUST use useRef, NOT a plain `{ current: null }` object.
 * A plain object is re-created on every render, which causes all downstream
 * hooks to receive a stale null ref after the first re-render.
 */
export function useMapInit(containerRef: RefObject<HTMLDivElement | null>): RefObject<maplibregl.Map | null> {
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    // Read initial values from store without subscribing (avoids re-running the effect)
    const { camera, mapView, basemap } = useMapStore.getState()
    const { theme } = useUIStore.getState()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveMapStyle(theme, basemap),
      center: [camera.lng, camera.lat],
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    })

    mapRef.current = map
    useMapStore.getState().setMapInstance(map)

    map.once("load", () => {
      map.setProjection({
        type: mapView === "3d" ? "globe" : "mercator",
      })
    })

    // ResizeObserver keeps the canvas sized correctly without relying on
    // window resize events (handles sidebar open/close transitions too).
    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(containerRef.current!)

    return () => {
      observer.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
      useMapStore.getState().setMapInstance(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionally run once — map lifecycle is managed imperatively

  return mapRef
}
