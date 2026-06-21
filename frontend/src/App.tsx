import React from "react"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import { MapContainer } from "@/components/map/MapContainer"
import { MapLegend } from "@/components/overlays/MapLegend"
import { LiveToggle } from "@/components/overlays/LiveToggle"
import { MapControls } from "@/components/overlays/MapControls"
import { TopStats } from "@/components/overlays/TopStats"
import { BottomStatusBar } from "@/components/overlays/BottomStatusBar"
import { TerrainToggle } from "@/components/overlays/TerrainToggle"
import { AppSidebar } from "@/components/sidebar/AppSidebar"

import { useMapStore } from "@/store/use-map-store"

function App() {
  const [isOpen, setIsOpen] = React.useState(true)
  const { mapView, basemap, showFires, showTerrain } = useMapStore()

  return (
    <SidebarProvider open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <AppSidebar />

        <SidebarInset className='relative p-0 overflow-hidden bg-muted/20'>
          <div className='absolute inset-0 z-0'>
            <MapContainer basemap={basemap} mapView={mapView} showFires={showFires} showTerrain={showTerrain} />
          </div>

          <TopStats />
          <MapControls />
          <MapLegend />
          <LiveToggle />
          <TerrainToggle />
          <BottomStatusBar />
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  )
}

export default App
