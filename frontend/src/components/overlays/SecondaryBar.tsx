import { MapLegend } from "@/components/overlays/MapLegend"
import { LiveToggle } from "@/components/overlays/LiveToggle"
import { MapControls } from "@/components/overlays/MapControls"
import { TerrainToggle } from "@/components/overlays/TerrainToggle"
import { LayerToggle } from "@/components/overlays/LayerToggle"
import { ThemeToggle } from "@/components/overlays/ThemeToggle"

import { useMapStore } from "@/store/use-map-store"

export function SecondaryBar() {
  const { showRiskGrid, showFires } = useMapStore()

  return (
    <div className='absolute top-2 right-2 z-10 flex flex-col items-end gap-2 pointer-events-none'>
      <MapControls />
      <LiveToggle />
      <LayerToggle />
      <TerrainToggle />
      {showRiskGrid && <MapLegend title='Fire Weather Index' type='fwi' />}
      {showFires && <MapLegend title='Active Fires (VIIRS)' type='viirs' />}
      <ThemeToggle />
    </div>
  )
}
