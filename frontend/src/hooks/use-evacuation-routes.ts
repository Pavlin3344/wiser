import { useEffect, type RefObject } from "react"
import type maplibregl from "maplibre-gl"
import { toast } from "sonner"
import type { FeatureCollection } from "geojson"

import { fetchEvacuationRoutes, RoutingTopologyMissingError } from "@/services/evacuationService"
import { useLayerStore } from "@/store/use-layer-store"
import { useMapStore } from "@/store/use-map-store"

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] }

/**
 * Loads real evacuation routes for wherever the user is, and clears the layer when
 * they are unavailable. Nothing is ever drawn from placeholder data: an invented
 * escape route is more dangerous than an empty map.
 */
export function useEvacuationRoutes(mapRef: RefObject<maplibregl.Map | null>): void {
  const showEvac = useLayerStore((s) => s.showEvac)
  const userLocation = useMapStore((s) => s.userLocation)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let cancelled = false

    const setRoutes = (data: FeatureCollection) => {
      const source = map.getSource("evac-routes") as maplibregl.GeoJSONSource | undefined
      source?.setData(data)
    }

    if (!showEvac) {
      setRoutes(EMPTY)
      return
    }

    if (!userLocation) {
      setRoutes(EMPTY)
      toast.info("Evacuation routes need your position", {
        description: "Use the locate button to find routes from where you are.",
      })
      return
    }

    fetchEvacuationRoutes(userLocation.lat, userLocation.lng)
      .then((routes) => {
        if (cancelled) return
        setRoutes(routes)
        if (routes.features.length === 0) {
          toast.warning("No safe evacuation route found", {
            description: "Every road towards the nearest assembly points passes an active fire.",
          })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setRoutes(EMPTY)

        if (err instanceof RoutingTopologyMissingError) {
          toast.error("Routing data not imported", { description: err.message, duration: 10_000 })
          return
        }
        console.warn(`[Wiser] Could not load evacuation routes (${err}).`)
        toast.warning("Could not load evacuation routes.")
      })

    return () => {
      cancelled = true
    }
  }, [mapRef, showEvac, userLocation])
}
