import { Map, Flame, LineChart, Bell } from "lucide-react"

import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"

import { AnalysisView } from "@/components/sidebar/AnalysisView"
import { AlertsView } from "@/components/sidebar/AlertsView"
import { FiltersView } from "@/components/sidebar/FiltersView"
import { DetectionView } from "@/components/sidebar/DetectionView"

import { useMapStore } from "@/store/use-map-store"

export function AppSidebar() {
  const { activeSidebarTab, setActiveSidebarTab } = useMapStore()

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
    <Sidebar variant='sidebar' collapsible='offcanvas' className='bg-background/80 backdrop-blur-md shadow-sm rounded-2xl border-none'>
      <div className='p-2 flex items-center justify-end'>
        <SidebarTrigger className='cursor-pointer' />
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
  )
}
