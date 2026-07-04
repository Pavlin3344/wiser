import { useEffect, useRef } from "react"

import { Crosshair, Mountain, Search } from "lucide-react"

import { useMapStore } from "@/store/use-map-store"

export function BottomStatusBar() {
  const coordsRef = useRef<HTMLSpanElement>(null)
  const elevationRef = useRef<HTMLSpanElement>(null)
  const zoomRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const unsub = useMapStore.subscribe(
      (s) => s.mapStatus,
      ({ lat, lng, elevation, zoom }) => {
        if (coordsRef.current) coordsRef.current.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`

        if (elevationRef.current) elevationRef.current.textContent = `${elevation}m ASL`

        if (zoomRef.current) zoomRef.current.textContent = `ZOOM: ${zoom.toFixed(1)}`
      },
    )
    return unsub
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

      <div className='flex items-center gap-6'>
        <div className='flex items-center gap-1.5'>
          <Search className='size-3 text-destructive' />
          <span ref={zoomRef}>ZOOM: 7.0</span>
        </div>

        <div className='text-border'>|</div>

        <span className='font-semibold text-destructive'>Wiser System Core v1.0</span>
      </div>
    </div>
  )
}
