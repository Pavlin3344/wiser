import { Crosshair, Mountain, Search } from "lucide-react"

export function BottomStatusBar() {
  return (
    <div className='absolute bottom-2 left-2 right-2 h-8 bg-background/60 backdrop-blur-xl border border-white/10 border-t-white/20 border-l-white/20 rounded-full z-20 flex items-center justify-between px-4 pointer-events-auto text-[10px] font-mono text-muted-foreground uppercase tracking-wider'>
      <div className='absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent' />

      <div className='flex items-center gap-6'>
        <div className='flex items-center gap-1.5'>
          <Crosshair className='size-3 text-primary' />
          <span id='ui-coords'>0.0000° N, 0.0000° E</span>
        </div>

        <div className='flex items-center gap-1.5'>
          <Mountain className='size-3 text-primary' />
          <span id='ui-elevation'>0m ASL</span>
        </div>
      </div>

      <div className='flex items-center gap-6'>
        <div className='flex items-center gap-1.5'>
          <Search className='size-3 text-primary' />
          <span id='ui-zoom'>ZOOM: 7.0</span>
        </div>

        <div className='text-border'>|</div>

        <span className='font-semibold text-primary'>Wiser System Core v1.0</span>
      </div>
    </div>
  )
}
