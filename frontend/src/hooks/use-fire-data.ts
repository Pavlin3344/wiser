import { useEffect, type RefObject } from "react"
import type maplibregl from "maplibre-gl"
import type { FeatureCollection } from "geojson"
import { syncLayers } from "./use-map-layers"
import { fetchActiveFires } from "@/services/fireService"

/** How often to re-fetch active fire data from the backend (ms). */
const POLL_INTERVAL_MS = 5 * 60 * 1_000 // 5 minutes

/**
 * Handles fetching real active fire data from the backend.
 * Updates the MapLibre layers and synchronizes the active fire count in the global store.
 * Re-fetches automatically every POLL_INTERVAL_MS while the component is mounted.
 */
export function useFireData({ mapRef, fireDataRef }: { mapRef: RefObject<maplibregl.Map | null>; fireDataRef: RefObject<FeatureCollection> }): void {
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const fetchAndSyncData = () => {
      fetchActiveFires()
        .then((data) => {
          fireDataRef.current = data
          syncLayers(map, data)
        })
        .catch((err) => {
          console.warn(`[Wiser] Backend unavailable (${err}). Using EFFIS mock data.`)
          // Keep the current mock/stale data in place — do not wipe the map
          syncLayers(map, fireDataRef.current)
        })
    }

    // Fetch immediately on mount (or once the map is loaded)
    if (map.loaded()) {
      fetchAndSyncData()
    } else {
      map.once("load", fetchAndSyncData)
    }

    // Then poll on a regular interval
    const intervalId = setInterval(fetchAndSyncData, POLL_INTERVAL_MS)

    return () => {
      map.off("load", fetchAndSyncData)
      clearInterval(intervalId)
    }
  }, [mapRef, fireDataRef])
}
