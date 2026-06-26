import { Minus, Plus, Navigation } from "lucide-react"

interface MapNavigationProps {
  mapRef: React.RefObject<maplibregl.Map | null>
}

export function MapNavigation({ mapRef }: MapNavigationProps) {
  return (
    <div className='absolute right-2 bottom-12 z-10 flex flex-col gap-2'>
      <div className='relative flex flex-col bg-background/60 backdrop-blur-xl shadow-lg rounded-full overflow-hidden border border-white/10 border-t-white/20 border-l-white/20'>
        <div className='absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

        <button onClick={() => mapRef.current?.zoomIn()} className='size-9 flex items-center justify-center text-foreground hover:bg-muted/80 border-b border-white/10 transition-colors cursor-pointer z-10' title='Zoom In'>
          <Plus className='size-3' />
        </button>

        <button onClick={() => mapRef.current?.zoomOut()} className='size-9 flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors cursor-pointer z-10' title='Zoom Out'>
          <Minus className='size-3' />
        </button>
      </div>

      <button onClick={() => mapRef.current?.resetNorthPitch()} className='relative size-9 flex items-center justify-center bg-background/60 backdrop-blur-xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20 rounded-2xl text-foreground hover:bg-muted/80 transition-colors cursor-pointer' title='Reset North'>
        <div className='absolute inset-0 rounded-full bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

        <div id='ui-compass-icon' className='transition-transform duration-75'>
          <Navigation className='size-3 text-destructive fill-primary/20' />
        </div>
      </button>
    </div>
  )
}
