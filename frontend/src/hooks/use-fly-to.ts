import { useEffect, type RefObject } from "react"
import type maplibregl from "maplibre-gl"
import { useMapStore } from "@/store/use-map-store"

export function useFlyTo(mapRef: RefObject<maplibregl.Map | null>) {
  const { flyToTarget, setFlyToTarget } = useMapStore()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyToTarget) return

    const timeout = setTimeout(() => {
      map.flyTo({
        center: [flyToTarget.lng, flyToTarget.lat],
        zoom: flyToTarget.zoom,
        essential: true,
        duration: 2500,
      })
      setFlyToTarget(null)
    }, 100)

    return () => clearTimeout(timeout)
  }, [flyToTarget, mapRef, setFlyToTarget])
}
