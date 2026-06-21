import React from "react"

import { Map, Flame, LineChart, Bell } from "lucide-react"

import { Sidebar, SidebarProvider, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarInset, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import { MapContainer } from "@/components/map/MapContainer"
import { useMapStore } from "@/store/use-map-store"
import { MapLegend } from "@/components/overlays/MapLegend"
import { LiveToggle } from "@/components/overlays/LiveToggle"
import { MapControls } from "@/components/overlays/MapControls"
import { TopStats } from "@/components/overlays/TopStats"
import { AnalysisView } from "@/components/sidebar/AnalysisView"
import { AlertsView } from "@/components/sidebar/AlertsView"
import { FiltersView } from "@/components/sidebar/FiltersView"
import { DetectionView } from "@/components/sidebar/DetectionView"
import { BottomStatusBar } from "@/components/overlays/BottomStatusBar"

function App() {
  const [isOpen, setIsOpen] = React.useState(true)
  const { activeSidebarTab, setActiveSidebarTab, mapView, basemap, showFires } = useMapStore()

  const renderSidebarContent = () => {
    switch (activeSidebarTab) {
      case "analysis":
        return <AnalysisView />
      case "alerts":
        return <AlertsView />
      case "detection":
        return <DetectionView />
      case "risk":
      default:
        return <FiltersView />
    }
  }

  return (
    <SidebarProvider open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Sidebar variant='sidebar' collapsible='offcanvas' className='bg-background/80 backdrop-blur-md shadow-sm rounded-2xl border-none'>
          <div className='p-2 flex items-center justify-end'>
            <SidebarTrigger />
          </div>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setActiveSidebarTab("risk")} isActive={activeSidebarTab === "risk"}>
                    <Map className={activeSidebarTab === "risk" ? "text-destructive" : ""} />
                    Risk Assessment
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setActiveSidebarTab("detection")} isActive={activeSidebarTab === "detection"}>
                    <Flame className={activeSidebarTab === "detection" ? "text-destructive" : ""} />
                    Detection
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setActiveSidebarTab("analysis")} isActive={activeSidebarTab === "analysis"}>
                    <LineChart className={activeSidebarTab === "analysis" ? "text-destructive" : ""} />
                    Analysis & Trends
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setActiveSidebarTab("alerts")} isActive={activeSidebarTab === "alerts"}>
                    <Bell className={activeSidebarTab === "alerts" ? "text-destructive" : ""} />
                    System Alerts
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            {renderSidebarContent()}
          </SidebarContent>
        </Sidebar>

        <SidebarInset className='relative p-0 overflow-hidden bg-muted/20'>
          <div className='absolute inset-0 z-0'>
            <MapContainer basemap={basemap} mapView={mapView} showFires={showFires} />
          </div>

          <TopStats />
          <MapControls />
          <MapLegend />
          <LiveToggle />
          <BottomStatusBar />
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  )
}

export default App
