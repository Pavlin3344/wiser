import { useEffect, useRef } from "react"

import { Camera, Crosshair, Mountain, Search } from "lucide-react"

import { useMapStore } from "@/store/use-map-store"
import { MapScale } from "@/components/overlays/MapScale"

export function BottomStatusBar() {
  const coordsRef = useRef<HTMLSpanElement>(null)
  const elevationRef = useRef<HTMLSpanElement>(null)
  const zoomRef = useRef<HTMLSpanElement>(null)
  const cameraDistanceRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const formatDistance = (meters: number, unit: "metric" | "imperial"): string => {
      if (unit === "metric") {
        if (meters < 1000) {
          return `CAMERA: ${Math.round(meters)}m`
        } else {
          return `CAMERA: ${(Math.round(meters / 1000))}km`
        }
      } else {
        const feet = meters * 3.28084
        if (feet < 5280) {
          return `CAMERA: ${Math.round(feet)}ft`
        } else {
          return `CAMERA: ${(Math.round(feet / 5280))}mi`
        }
      }
    }

    const initialState = useMapStore.getState()
    const currentStatus = initialState.mapStatus
    const unit = initialState.scaleUnit

    if (coordsRef.current) {
      coordsRef.current.textContent = `${currentStatus.lat.toFixed(4)}° N, ${currentStatus.lng.toFixed(4)}° E`
    }
    if (elevationRef.current) {
      elevationRef.current.textContent = `${currentStatus.elevation}m ASL`
    }
    if (zoomRef.current) {
      zoomRef.current.textContent = `ZOOM: ${currentStatus.zoom.toFixed(1)}`
    }
    if (cameraDistanceRef.current) {
      cameraDistanceRef.current.textContent = formatDistance(currentStatus.cameraDistance, unit)
    }

    const unsubStatus = useMapStore.subscribe(
      (s) => s.mapStatus,
      ({ lat, lng, elevation, zoom, cameraDistance }) => {
        if (coordsRef.current) coordsRef.current.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`

        if (elevationRef.current) elevationRef.current.textContent = `${elevation}m ASL`

        if (zoomRef.current) zoomRef.current.textContent = `ZOOM: ${zoom.toFixed(1)}`

        if (cameraDistanceRef.current) {
          const unit = useMapStore.getState().scaleUnit
          cameraDistanceRef.current.textContent = formatDistance(cameraDistance, unit)
        }
      },
    )

    const unsubUnit = useMapStore.subscribe(
      (s) => s.scaleUnit,
      (unit) => {
        if (cameraDistanceRef.current) {
          const cameraDistance = useMapStore.getState().mapStatus.cameraDistance
          cameraDistanceRef.current.textContent = formatDistance(cameraDistance, unit)
        }
      },
    )

    return () => {
      unsubStatus()
      unsubUnit()
    }
  }, [])

  return (
    <div className='absolute bottom-2 left-2 right-2 h-8 bg-background/60 backdrop-blur-xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20 rounded-full z-20 hidden md:flex items-center justify-between px-4 pointer-events-auto text-[10px] font-mono text-muted-foreground uppercase tracking-wider'>
      <div className='absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent' />

      <div className='flex items-center gap-6'>
        <div className='flex items-center gap-1.5'>
          <Crosshair className='size-3 text-destructive' />
          <span ref={coordsRef}>0.0000° N, 0.0000° E</span>
        </div>

        <div className='flex items-center gap-1.5'>
          <Mountain className='size-3 text-destructive' />
          <span ref={elevationRef}>0m ASL</span>
        </div>
      </div>

      <MapScale variant='inline' />

      <div className='flex items-center gap-6'>
        <div className='flex items-center gap-1.5'>
          <Camera className='size-3 text-destructive' />
          <span ref={cameraDistanceRef}>CAMERA: 0m</span>
        </div>

        <div className='flex items-center gap-1.5'>
          <Search className='size-3 text-destructive' />
          <span ref={zoomRef}>ZOOM: 7.0</span>
        </div>

        <div className='text-border'>|</div>

        <span className='font-semibold text-destructive'>Wiser Core v1.0</span>
      </div>
    </div>
  )
}

