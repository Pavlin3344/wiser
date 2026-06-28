import { useEffect, useRef } from "react"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection } from "geojson"

import { MapNavigation } from "@/components/map/MapNavigation"
import { mockFireData } from "@/mocks/fire-data"
import { useMapEvents } from "@/hooks/use-map-events"
import { useMapInit } from "@/hooks/use-map-init"
import { initializeLayers, syncLayers, useMapLayers } from "@/hooks/use-map-layers"
import { useMapStyle, useMapView, useTimePlayback } from "@/hooks/use-map-style"
import { useWindAnimation } from "@/hooks/use-wind-animation"
import { useFireData } from "@/hooks/use-fire-data"
import { useFlyTo } from "@/hooks/use-fly-to"

export function MapContainer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const fireDataRef = useRef<FeatureCollection>(mockFireData)
  const mapRef = useMapInit(containerRef)

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
  useMapLayers(mapRef, fireDataRef)
  useMapEvents(mapRef)
  useWindAnimation(mapRef)
  useMapStyle(mapRef, fireDataRef)
  useMapView(mapRef)
  useTimePlayback(mapRef, fireDataRef)

  return (
    <div className='absolute inset-0 z-0'>
      <div className='relative h-full w-full'>
        <div ref={containerRef} className='h-full w-full' />
        <MapNavigation mapRef={mapRef} />
      </div>
    </div>
  )
}
