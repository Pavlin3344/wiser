import { Label } from "@/components/ui/label"

export function MapLegend() {
  return (
    <div className='absolute bottom-24 right-2 z-10 pointer-events-auto'>
      <div className='bg-background/70 backdrop-blur-md shadow-sm rounded-2xl p-3 flex flex-col gap-2 w-full'>
        <Label className='text-[10px] uppercase tracking-wider text-muted-foreground font-bold'>Map Legend</Label>
        <div className='flex flex-col gap-1.5'>
          <div className='flex items-center gap-2'>
            <div className='size-3 rounded-full bg-destructive border border-white/20' />
            <span className='text-[10px] font-medium'>Active Ignition</span>
          </div>
          <div className='flex items-center gap-2'>
            <div className='size-3 rounded-sm bg-orange-500/80 border border-white/20' />
            <span className='text-[10px] font-medium'>High Risk Zone</span>
          </div>
          <div className='flex items-center gap-2'>
            <div className='size-3 rounded-sm bg-amber-400/80 border border-white/20' />
            <span className='text-[10px] font-medium'>Moderate Risk</span>
          </div>
        </div>
      </div>
    </div>
  )
}
