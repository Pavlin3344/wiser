import { MapLegend } from "@/components/overlays/MapLegend"
import { LiveToggle } from "@/components/overlays/LiveToggle"
import { MapControls } from "@/components/overlays/MapControls"
import { TerrainToggle } from "@/components/overlays/TerrainToggle"
import { LayerToggle } from "@/components/overlays/LayerToggle"
import { ThemeToggle } from "@/components/overlays/ThemeToggle"

export function SecondaryBar() {
  return (
    <div className='absolute top-2 right-2 z-10 flex flex-col items-end gap-2 pointer-events-none'>
      <MapControls />
      <LiveToggle />
      <LayerToggle />
      <TerrainToggle />
      <MapLegend />
      <ThemeToggle />
    </div>
  )
}
