import { Label } from "@/components/ui/label"

export function MapLegend() {
  return (
    <div className='pointer-events-auto w-52'>
      <div className='bg-background/60 backdrop-blur-xl shadow-lg rounded-2xl border border-white/10 border-t-white/20 border-l-white/20 p-3 flex flex-col gap-2'>
        <div className='absolute inset-0 rounded-2xl bg-linear-to-br from-white/5 to-transparent pointer-events-none' />
        <Label className='text-[11px] uppercase tracking-wider text-muted-foreground font-bold'>Map Legend</Label>

        <div className='flex flex-col gap-1.5'>
          <div className='flex items-center gap-2'>
            <div className='size-3 rounded-full bg-destructive border border-white/20' />
            <span className='text-[11px] font-medium'>Active Ignition</span>
          </div>
          <div className='flex items-center gap-2'>
            <div className='size-3 rounded-sm bg-orange-500/80 border border-white/20' />
            <span className='text-[11px] font-medium'>High Risk Zone</span>
          </div>
          <div className='flex items-center gap-2'>
            <div className='size-3 rounded-sm bg-amber-400/80 border border-white/20' />
            <span className='text-[11px] font-medium'>Moderate Risk</span>
          </div>
        </div>
      </div>
    </div>
  )
}
