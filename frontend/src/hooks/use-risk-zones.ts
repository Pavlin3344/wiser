import { useEffect, type RefObject } from "react"
import type maplibregl from "maplibre-gl"
import { toast } from "sonner"

import { fetchRiskZones } from "@/services/zoneService"
import { useLayerStore } from "@/store/use-layer-store"
import { useDataStore } from "@/store/use-data-store"
import type { RiskZoneCollection } from "@/types/types"

const EMPTY: RiskZoneCollection = { type: "FeatureCollection", features: [] }

/**
 * Loads Wiser's own risk zones when the layer is switched on.
 *
 * Only fetched on demand: the batch writes one cell per FWI grid point, so this is a
 * few thousand polygons - worth avoiding on every page load for a layer that starts
 * hidden. An empty table is reported rather than silently drawn as a clear map: the
 * daily batch not having run is a different thing from the country being at low risk.
 */
export function useRiskZones(mapRef: RefObject<maplibregl.Map | null>): void {
  const showRiskZones = useLayerStore((s) => s.showRiskZones)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let cancelled = false

    const setZones = (data: RiskZoneCollection) => {
      const source = map.getSource("risk-zones") as maplibregl.GeoJSONSource | undefined
      source?.setData(data)
    }

    const load = () => {
      if (!showRiskZones) {
        setZones(EMPTY)
        useDataStore.getState().setRiskZoneCount(0)
        return
      }

      fetchRiskZones()
        .then((zones) => {
          if (cancelled) return
          setZones(zones)
          useDataStore.getState().setRiskZoneCount(zones.features.length)

          if (zones.features.length === 0) {
            toast.warning("No risk zones computed yet", {
              description: "The daily batch has not written a risk surface for any date.",
              duration: 8_000,
            })
          }
        })
        .catch((err) => {
          if (cancelled) return
          setZones(EMPTY)
          useDataStore.getState().setRiskZoneCount(0)
          console.warn(`[Wiser] Could not load risk zones (${err}).`)
          toast.error("Risk zones unavailable", {
            description: "The backend did not return the computed risk surface.",
          })
        })
    }

    if (map.isStyleLoaded()) {
      load()
    } else {
      map.once("load", load)
    }

    return () => {
      cancelled = true
      map.off("load", load)
    }
  }, [mapRef, showRiskZones])
}
