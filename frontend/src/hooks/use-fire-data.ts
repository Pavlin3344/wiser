import { useEffect, type RefObject } from "react"
import type maplibregl from "maplibre-gl"
import type { FeatureCollection } from "geojson"
import { useMapStore } from "@/store/use-map-store"
import { syncLayers } from "./use-map-layers"

/**
 * Handles fetching real active fire data from the backend.
 * Updates the MapLibre layers and synchronizes the active fire count in the global store.
 */
export function useFireData({ mapRef, fireDataRef }: { mapRef: RefObject<maplibregl.Map | null>; fireDataRef: RefObject<FeatureCollection> }): void {
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const fetchAndSyncData = () => {
      useMapStore.getState().setActiveFireCount(fireDataRef.current.features.length)

      fetch("/api/v1/fires/active")
        .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : Promise.reject(r.status)))
        .then((data) => {
          fireDataRef.current = data
          syncLayers(map, data)
          useMapStore.getState().setActiveFireCount(data.features.length)
        })
        .catch((err) => {
          console.warn(`[Wiser] Backend unavailable (${err}). Using EFFIS mock data.`)
          useMapStore.getState().setActiveFireCount(fireDataRef.current.features.length)
        })
    }

    if (map.loaded()) {
      fetchAndSyncData()
    } else {
      map.once("load", fetchAndSyncData)
    }

    return () => {
      map.off("load", fetchAndSyncData)
    }
  }, [mapRef, fireDataRef])
}
