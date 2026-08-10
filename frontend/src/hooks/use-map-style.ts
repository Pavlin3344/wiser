import { useEffect, type RefObject } from "react"
import maplibregl from "maplibre-gl"
import type { FeatureCollection } from "geojson"
import { useMapStore } from "@/store/use-map-store"
import { useUIStore } from "@/store/use-ui-store"
import { useFilterStore } from "@/store/use-filter-store"
import { resolveMapStyle } from "@/hooks/use-map-init"
import { initializeLayers, syncLayers } from "@/hooks/use-map-layers"

/**
 * Reloads the map style whenever basemap or theme changes,
 * then re-initialises all application layers on top of it.
 */
export function useMapStyle(mapRef: RefObject<maplibregl.Map | null>, fireDataRef: RefObject<FeatureCollection>): void {
  const { basemap } = useMapStore()
  const { theme } = useUIStore()

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const updateStyle = () => {
      map.setStyle(resolveMapStyle(theme, basemap))

      map.once("styledata", () => {
        initializeLayers(map)
        syncLayers(map, fireDataRef.current)
        const currentMapView = useMapStore.getState().mapView
        map.setProjection({ type: currentMapView === "3d" ? "globe" : "mercator" })
      })
    }

    updateStyle()

    if (theme !== "system") return

    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    mq.addEventListener("change", updateStyle)
    return () => {
      mq.removeEventListener("change", updateStyle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, theme])
}

/**
 * Switches between Mercator and Globe projection and flies to a sane zoom.
 */
interface MapWithStyle {
  style?: {
    stylesheet?: unknown
  }
}

export function useMapView(mapRef: RefObject<maplibregl.Map | null>): void {
  const mapView = useMapStore((s) => s.mapView)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const style = (map as unknown as MapWithStyle).style
    if (!style || !style.stylesheet) return

    map.stop()
    map.setProjection({ type: mapView === "3d" ? "globe" : "mercator" })
    map.flyTo({ pitch: 0, bearing: 0, zoom: mapView === "3d" ? 2 : 7, duration: 1500 })
  }, [mapView, mapRef])
}

/**
 * Advances currentTime by 1 hour every 500 ms while isPlaying is true.
 */
export function useTimePlayback(mapRef: RefObject<maplibregl.Map | null>, fireDataRef: RefObject<FeatureCollection>): void {
  const isPlaying = useFilterStore((s) => s.isPlaying)

  useEffect(() => {
    if (!isPlaying) return

    const id = setInterval(() => {
      const map = mapRef.current
      if (!map) return
      const { currentTime, setCurrentTime } = useFilterStore.getState()
      setCurrentTime((currentTime + 1) % 24)
      syncLayers(map, fireDataRef.current)
    }, 500)

    return () => clearInterval(id)
  }, [isPlaying, mapRef, fireDataRef])
}
