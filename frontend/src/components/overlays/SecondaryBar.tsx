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
import { ResetNavigationButton } from "@/components/overlays/ResetNavigationButton"
import { MobileLayersDrawer } from "@/components/overlays/MobileLayersDrawer"

import { useUIStore } from "@/store/use-ui-store"
import { useLayerStore } from "@/store/use-layer-store"

export function SecondaryBar() {
  const { secondaryBarOpen, setSecondaryBarOpen } = useUIStore()
  const { showRiskGrid, showFires } = useLayerStore()
  const { isMobile } = useSidebar()

  return (
    <div className={`absolute z-10 pointer-events-none flex flex-col gap-2 ${isMobile ? "top-4 right-4" : "top-2 right-2"}`}>
      <Collapsible open={secondaryBarOpen} onOpenChange={setSecondaryBarOpen} className='flex flex-col gap-2'>
        <CollapsibleTrigger asChild className='self-end'>
          <Button className='size-9 pointer-events-auto cursor-pointer bg-destructive/60 backdrop-blur-xl hover:bg-destructive/70 rounded-full shadow-lg border border-white/10 border-t-white/20 border-l-white/20 flex items-center justify-center'>
            <ChevronsUpDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className='flex flex-col items-end gap-2'>
          {isMobile ? (
            <>
              <LocationToggle />
              <ResetNavigationButton />
            </>
          ) : (
            <>
              <MapControls />
              <LiveToggle />
              <LayerToggle />
              <TerrainToggle />
              {showRiskGrid && <MapLegend title='Fire Weather Index' type='fwi' />}
              {showFires && <MapLegend title='Active Fires (VIIRS)' type='viirs' />}
              <ThemeToggle />
              <LocationToggle />
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {isMobile && (
        <div className='self-end pointer-events-auto'>
          <MobileLayersDrawer />
        </div>
      )}
    </div>
  )
}
