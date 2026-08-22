import { useEffect, useRef, type RefObject } from "react"
import type maplibregl from "maplibre-gl"
import { toast } from "sonner"
import type { FeatureCollection } from "geojson"
import { clipToBulgaria, syncLayers } from "@/hooks/use-map-layers"
import { fetchActiveFires, FIRE_STREAM_URL } from "@/services/fireService"
import { useDataStore } from "@/store/use-data-store"
import { useFilterStore } from "@/store/use-filter-store"

/** Fallback poll interval, used only when the live stream cannot be established (ms). */
const POLL_INTERVAL_MS = 5 * 60 * 1_000 // 5 minutes

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] }

/**
 * Applies the detection filters to whatever the backend last returned.
 *
 * Clipping to the border happens here rather than only at draw time so the counter and
 * the map report the same set. They used to disagree by every detection abroad: the
 * badge said 207 while 105 dots were drawn.
 */
function filterDetections(raw: FeatureCollection, minConfidence: number, enabledSensors: string[]): FeatureCollection {
  const inCountry = clipToBulgaria(raw)
  return {
    ...inCountry,
    features: inCountry.features.filter((feature) => {
      const props = feature.properties ?? {}
      const confidence = typeof props.confidence === "number" ? props.confidence : 0
      if (confidence < minConfidence) return false
      // Detections from an unknown sensor are kept: hiding data because we do not
      // recognise its label would be worse than showing it.
      const source = typeof props.source === "string" ? props.source : null
      return source === null || enabledSensors.includes(source)
    }),
  }
}

/**
 * Keeps the map in sync with backend active fire data.
 *
 * Prefers a Server-Sent Events stream so detections appear as they are ingested;
 * falls back to polling when the stream cannot be established. There is no offline
 * fallback data - an unreachable backend leaves the map empty and says so.
 */
export function useFireData({ mapRef, fireDataRef }: { mapRef: RefObject<maplibregl.Map | null>; fireDataRef: RefObject<FeatureCollection> }): void {
  const minConfidence = useFilterStore((s) => s.minConfidence)
  const enabledSensors = useFilterStore((s) => s.enabledSensors)
  const liveUpdates = useFilterStore((s) => s.liveUpdates)

  // Unfiltered backend response, so changing a filter re-renders without a refetch.
  const rawRef = useRef<FeatureCollection>(EMPTY)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let eventSource: EventSource | null = null
    let pollIntervalId: ReturnType<typeof setInterval> | null = null
    let warnedOffline = false

    const render = () => {
      const filtered = filterDetections(rawRef.current, minConfidence, enabledSensors)
      fireDataRef.current = filtered
      syncLayers(map, filtered)
      useDataStore.getState().setActiveFireCount(filtered.features.length)
    }

    const applyData = (data: FeatureCollection) => {
      rawRef.current = data
      render()
    }

    const reportOffline = (reason: string) => {
      console.warn(`[Wiser] Could not load active fires (${reason}).`)
      if (!warnedOffline) {
        warnedOffline = true
        toast.error("Live fire data unavailable", {
          description: "The map cannot be trusted until the backend responds again.",
          duration: 10_000,
        })
      }
    }

    const fetchAndSyncData = () => {
      fetchActiveFires()
        .then((data) => {
          warnedOffline = false
          applyData(data)
        })
        .catch((err) => reportOffline(String(err)))
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
      if (liveUpdates) startStream()
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
  }, [mapRef, fireDataRef, minConfidence, enabledSensors, liveUpdates])
}
