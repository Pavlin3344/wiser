import { Map as MapIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useMapStore } from "@/store/use-map-store"

export function LayerToggle() {
  const { showLabels, setShowLabels, basemap } = useMapStore()

  if (basemap !== "satellite") return null

  return (
    <div className='pointer-events-auto flex flex-col items-end gap-2 w-52'>
      <div
        className='
        relative bg-background/60 backdrop-blur-xl shadow-lg rounded-2xl 
        border border-white/10 border-t-white/20 border-l-white/20 
        p-3 flex items-center justify-between w-full
      '
      >
        <div className='absolute inset-0 rounded-2xl bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

        <div className='flex flex-col gap-1 z-10'>
          <Label className='text-sm font-semibold flex items-center gap-1.5 cursor-pointer' onClick={() => setShowLabels(!showLabels)}>
            <MapIcon className='size-4 text-primary' /> Map Overlays
          </Label>
          <span className='text-[12px] text-muted-foreground leading-none'>Borders & Labels</span>
        </div>

        <Switch checked={showLabels} onCheckedChange={setShowLabels} className='z-10' />
      </div>
    </div>
  )
}
