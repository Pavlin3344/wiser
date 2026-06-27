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

      fetch("/api/v1/fires/active")
        .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : Promise.reject(r.status)))
        .then((data) => {
          fireDataRef.current = data
          syncLayers(map, data)
        })
        .catch((err) => {
          console.warn(`[Wiser] Backend unavailable (${err}). Using EFFIS mock data.`)
        })
    }

    map.once("load", handleLoad)

    return () => {
      map.off("load", handleLoad)
    }
  }, [mapRef])

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
