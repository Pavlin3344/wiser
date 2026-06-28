import { useEffect, useRef, type RefObject } from "react"
import maplibregl, { type StyleSpecification } from "maplibre-gl"
import { useMapStore } from "@/store/use-map-store"
import { satelliteStyle } from "@/lib/map-config"

const LIGHT_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

export function resolveMapStyle(theme: string, basemap: string): string | StyleSpecification {
  if (basemap === "satellite") return satelliteStyle
  return theme === "dark" ? DARK_STYLE : LIGHT_STYLE
}

/**
 * Creates and tears down the MapLibre instance.
 * Returns a stable ref — consumers should never re-create the map themselves.
 */
export function useMapInit(containerRef: RefObject<HTMLDivElement | null>): RefObject<maplibregl.Map | null> {
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    const { camera, theme, basemap, mapView } = useMapStore.getState()

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: resolveMapStyle(theme, basemap),
      center: [camera.lng, camera.lat],
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    })

    mapRef.current.once("load", () => {
      mapRef.current!.setProjection({
        type: mapView === "3d" ? "globe" : "mercator",
      })
    })

    // Resize observer keeps the canvas sized correctly without relying on
    // window resize events (handles sidebar open/close transitions too).
    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(containerRef.current!)

    return () => {
      observer.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionally run once — map lifecycle is managed imperatively

  return mapRef
}
