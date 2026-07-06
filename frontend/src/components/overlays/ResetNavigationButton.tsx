import { useEffect, useRef } from "react"
import { Navigation } from "lucide-react"

import { useMapStore } from "@/store/use-map-store"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function ResetNavigationButton() {
  const compassRef = useRef<HTMLDivElement>(null)
  const mapInstance = useMapStore((s) => s.mapInstance)

  useEffect(() => {
    // Keep pointer rotated matching map bearing
    const unsub = useMapStore.subscribe(
      (s) => s.mapStatus.bearing,
      (bearing) => {
        if (compassRef.current) {
          compassRef.current.style.transform = `rotate(${-bearing}deg)`
        }
      },
    )
    return unsub
  }, [])

  const reset = () => {
    if (mapInstance) {
      mapInstance.resetNorthPitch()
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={reset}
          className='relative size-9 flex items-center justify-center bg-background/60 backdrop-blur-xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20 rounded-full text-foreground hover:bg-muted/80 transition-colors cursor-pointer pointer-events-auto'
        >
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
  )
}
