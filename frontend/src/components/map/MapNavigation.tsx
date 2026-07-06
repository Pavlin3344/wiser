import { useEffect, useRef } from "react"

import { Minus, Plus, Navigation } from "lucide-react"

import { useMapStore } from "@/store/use-map-store"
import { useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface MapNavigationProps {
  mapRef: React.RefObject<maplibregl.Map | null>
}

export function MapNavigation({ mapRef }: MapNavigationProps) {
  const compassRef = useRef<HTMLDivElement>(null)
  const { isMobile } = useSidebar()

  useEffect(() => {
    const unsub = useMapStore.subscribe(
      (s) => s.mapStatus.bearing,
      (bearing) => {
        if (compassRef.current) compassRef.current.style.transform = `rotate(${-bearing}deg)`
      },
    )
    return unsub
  }, [])

  const zoomIn = () => mapRef.current?.zoomIn()
  const zoomOut = () => mapRef.current?.zoomOut()
  const reset = () => mapRef.current?.resetNorthPitch()

  if (isMobile) return null

  return (
    <div className='absolute right-2 z-10 flex flex-col gap-2 bottom-12'>
      <div className='relative hidden sm:flex flex-col bg-background/60 backdrop-blur-xl shadow-lg rounded-full overflow-hidden border border-white/10 border-t-white/20 border-l-white/20'>
        <div className='absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={zoomIn} className='size-9 flex items-center justify-center text-foreground hover:bg-muted/80 border-b border-white/10 transition-colors cursor-pointer z-10'>
              <Plus className='size-3' />
            </button>
          </TooltipTrigger>
          <TooltipContent side='left' sideOffset={8}>
            Zoom In
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={zoomOut} className='size-9 flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors cursor-pointer z-10'>
              <Minus className='size-3' />
            </button>
          </TooltipTrigger>
          <TooltipContent side='left' sideOffset={8}>
            Zoom Out
          </TooltipContent>
        </Tooltip>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={reset} className='relative size-9 flex items-center justify-center bg-background/60 backdrop-blur-xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20 rounded-full text-foreground hover:bg-muted/80 transition-colors cursor-pointer'>
            <div className='absolute inset-0 rounded-full bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

            <div ref={compassRef} className='transition-transform duration-75'>
              <Navigation className='size-3 text-destructive fill-primary/20' />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side='left' sideOffset={8}>
          Reset North
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
