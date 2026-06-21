import React from "react"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import { AppSidebar } from "@/components/sidebar/AppSidebar"
import { MapContainer } from "@/components/map/MapContainer"
import { TopBar } from "@/components/overlays/TopBar"
import { SecondaryBar } from "@/components/overlays/SecondaryBar"
import { BottomStatusBar } from "@/components/overlays/BottomStatusBar"

import { useMapStore } from "@/store/use-map-store"

function App() {
  const [isOpen, setIsOpen] = React.useState(true)
  const { mapView, basemap, showFires, showTerrain } = useMapStore()

  return (
    <SidebarProvider open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <AppSidebar />

        <SidebarInset className='absolute inset-0 p-0 overflow-hidden'>
          <MapContainer basemap={basemap} mapView={mapView} showFires={showFires} showTerrain={showTerrain} />

          <TopBar />
          <SecondaryBar />
          <BottomStatusBar />
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  )
}

export default App
