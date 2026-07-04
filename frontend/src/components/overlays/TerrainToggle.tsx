import { Mountain } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { useLayerStore } from "@/store/use-layer-store"
import { useMapStore } from "@/store/use-map-store"

export function TerrainToggle() {
  const { showTerrain, setShowTerrain } = useLayerStore()
  const { basemap } = useMapStore()

  if (basemap !== "satellite") return null

  return (
    <div className='relative pointer-events-auto flex flex-col items-end gap-2 w-52'>
      <div className='bg-background/60 backdrop-blur-xl shadow-lg rounded-2xl border border-white/10 border-t-white/20 border-l-white/20 p-3 flex items-center justify-between w-full'>
        <div className='absolute inset-0 rounded-2xl bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

        <div className='flex flex-col gap-1'>
          <Label className='text-sm font-semibold flex items-center gap-1.5 cursor-pointer' onClick={() => setShowTerrain(!showTerrain)}>
            <Mountain className='size-4 text-destructive' /> 3D Terrain
          </Label>
          <span className='text-[12px] text-muted-foreground leading-none'>Topographic elevation view</span>
        </div>
        <Switch checked={showTerrain} onCheckedChange={setShowTerrain} className='data-[state=checked]:bg-destructive data-[state=checked]:border-destructive' />
      </div>
    </div>
  )
}
