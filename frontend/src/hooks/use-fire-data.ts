import { useEffect, type RefObject } from "react"
import type maplibregl from "maplibre-gl"
import { toast } from "sonner"
import type { FeatureCollection } from "geojson"
import { syncLayers } from "@/hooks/use-map-layers"
import { fetchActiveFires, FIRE_STREAM_URL } from "@/services/fireService"
import { useDataStore } from "@/store/use-data-store"

/** Fallback poll interval, used only when the live stream cannot be established (ms). */
const POLL_INTERVAL_MS = 5 * 60 * 1_000 // 5 minutes

/**
 * Keeps the map in sync with backend active fire data.
 *
 * Prefers a Server-Sent Events stream so detections appear as they are ingested;
 * falls back to polling when the stream cannot be established (proxy or network
 * blocking text/event-stream).
 */
export function useFireData({ mapRef, fireDataRef }: { mapRef: RefObject<maplibregl.Map | null>; fireDataRef: RefObject<FeatureCollection> }): void {
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let eventSource: EventSource | null = null
    let pollIntervalId: ReturnType<typeof setInterval> | null = null
    let warnedOffline = false

    const applyData = (data: FeatureCollection) => {
      fireDataRef.current = data
      syncLayers(map, data)
      useDataStore.getState().setActiveFireCount(data.features.length)
    }

    const keepStaleData = (reason: string) => {
      console.warn(`[Wiser] Backend unavailable (${reason}). Using EFFIS mock data.`)
      if (!warnedOffline) {
        warnedOffline = true
        toast.warning("Backend unavailable. Using EFFIS mock data.")
      }
      syncLayers(map, fireDataRef.current)
      useDataStore.getState().setActiveFireCount(fireDataRef.current.features.length)
    }

    const fetchAndSyncData = () => {
      fetchActiveFires()
        .then(applyData)
        .catch((err) => keepStaleData(String(err)))
    }

    const startPolling = () => {
      if (pollIntervalId !== null) return
      pollIntervalId = setInterval(fetchAndSyncData, POLL_INTERVAL_MS)
    }

    const startStream = () => {
      if (typeof EventSource === "undefined") {
        startPolling()
        return
      }

      eventSource = new EventSource(FIRE_STREAM_URL)

      eventSource.addEventListener("fires", (event) => {
        try {
          applyData(JSON.parse((event as MessageEvent<string>).data) as FeatureCollection)
        } catch (err) {
          console.warn(`[Wiser] Ignoring malformed stream payload (${err}).`)
        }
      })

      // EventSource reconnects on its own, so polling is only a safety net for
      // environments where the stream never connects at all.
      eventSource.onerror = () => {
        if (eventSource?.readyState === EventSource.CLOSED) {
          startPolling()
        }
      }
    }

    const start = () => {
      fetchAndSyncData()
      startStream()
    }

    if (map.loaded()) {
      start()
    } else {
      map.once("load", start)
    }

    return () => {
      map.off("load", start)
      eventSource?.close()
      if (pollIntervalId !== null) clearInterval(pollIntervalId)
    }
  }, [mapRef, fireDataRef])
}
