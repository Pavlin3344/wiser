import { useEffect, useRef } from "react"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection } from "geojson"

import { MapNavigation } from "@/components/map/MapNavigation"
import { useMapEvents } from "@/hooks/use-map-events"
import { useMapInit } from "@/hooks/use-map-init"
import { initializeLayers, syncLayers, useMapLayers } from "@/hooks/use-map-layers"
import { useMapStyle, useMapView, useTimePlayback } from "@/hooks/use-map-style"
import { useFireData } from "@/hooks/use-fire-data"
import { useEvacuationRoutes } from "@/hooks/use-evacuation-routes"
import { useFlyTo } from "@/hooks/use-fly-to"
import { useLayerStore } from "@/store/use-layer-store"
import { WindLayer } from "@/components/map/WindLayer"
import { FuelLayer } from "@/components/map/FuelLayer"
import { HumanSettlementLayer } from "@/components/map/HumanSettlementLayer"
import { MapScale } from "@/components/overlays/MapScale"

export function MapContainer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const fireDataRef = useRef<FeatureCollection>({ type: "FeatureCollection", features: [] })
  const mapRef = useMapInit(containerRef)
  const showWind = useLayerStore((s) => s.showWind)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const handleLoad = () => {
      initializeLayers(map)
      syncLayers(map, fireDataRef.current)
    }

    map.once("load", handleLoad)

    return () => {
      map.off("load", handleLoad)
    }
  }, [mapRef])

  useFlyTo(mapRef)
  useFireData({ mapRef, fireDataRef })
  useEvacuationRoutes(mapRef)
  useMapLayers(mapRef, fireDataRef)
  useMapEvents(mapRef)
  useMapStyle(mapRef, fireDataRef)
  useMapView(mapRef)
  useTimePlayback(mapRef, fireDataRef)

  return (
    <div className='absolute inset-0 z-0'>
      <div className='relative h-full w-full'>
        <div ref={containerRef} className='h-full w-full' />
        {showWind && <WindLayer mapRef={mapRef} />}
        <FuelLayer mapRef={mapRef} />
        <HumanSettlementLayer mapRef={mapRef} />
        <MapNavigation mapRef={mapRef} />
        <MapScale variant='floating' className='absolute bottom-20 left-1/2 translate-x-[-50%] z-10 md:hidden' />
      </div>
    </div>
  )
}
