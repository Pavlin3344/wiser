import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

import { MapLegend } from "@/components/overlays/MapLegend"
import { LiveToggle } from "@/components/overlays/LiveToggle"
import { MapControls } from "@/components/overlays/MapControls"
import { TerrainToggle } from "@/components/overlays/TerrainToggle"
import { LayerToggle } from "@/components/overlays/LayerToggle"
import { ThemeToggle } from "@/components/overlays/ThemeToggle"

import { useMapStore } from "@/store/use-map-store"
import { LocationToggle } from "./LocationToggle"
import { ChevronsUpDown } from "lucide-react"

export function SecondaryBar() {
  const { secondaryBarOpen, setSecondaryBarOpen, showRiskGrid, showFires } = useMapStore()

  return (
    <div className='absolute top-2 right-2 z-10 pointer-events-none'>
      <Collapsible open={secondaryBarOpen} onOpenChange={setSecondaryBarOpen} className='flex flex-col gap-2'>
        <CollapsibleTrigger asChild className='self-end'>
          <Button className='size-9 pointer-events-auto cursor-pointer'>
            <ChevronsUpDown />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className='flex flex-col items-end gap-2'>
          <MapControls />
          <LiveToggle />
          <LayerToggle />
          <TerrainToggle />
          {showRiskGrid && <MapLegend title='Fire Weather Index' type='fwi' />}
          {showFires && <MapLegend title='Active Fires (VIIRS)' type='viirs' />}
          <ThemeToggle />
          <LocationToggle />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
