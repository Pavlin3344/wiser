import { ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useSidebar } from "@/components/ui/sidebar"

import { MapLegend } from "@/components/overlays/MapLegend"
import { LiveToggle } from "@/components/overlays/LiveToggle"
import { MapControls } from "@/components/overlays/MapControls"
import { TerrainToggle } from "@/components/overlays/TerrainToggle"
import { LayerToggle } from "@/components/overlays/LayerToggle"
import { ThemeToggle } from "@/components/overlays/ThemeToggle"
import { LocationToggle } from "@/components/overlays/LocationToggle"

import { useUIStore } from "@/store/use-ui-store"
import { useLayerStore } from "@/store/use-layer-store"

export function SecondaryBar() {
  const { secondaryBarOpen, setSecondaryBarOpen } = useUIStore()
  const { showRiskGrid, showFires } = useLayerStore()
  const { isMobile } = useSidebar()

  return (
    <div className={`absolute z-10 pointer-events-none ${isMobile ? "top-4 right-4" : "top-2 right-2"}`}>
      <Collapsible open={secondaryBarOpen} onOpenChange={setSecondaryBarOpen} className='flex flex-col gap-2'>
        <CollapsibleTrigger asChild className='self-end'>
          <Button className='size-9 pointer-events-auto cursor-pointer bg-destructive hover:bg-destructive/80'>
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
