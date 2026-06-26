import { Map, Flame, LineChart, Bell } from "lucide-react"

import { SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar"

import { AnalysisView } from "@/components/sidebar/AnalysisView"
import { AlertsView } from "@/components/sidebar/AlertsView"
import { FiltersView } from "@/components/sidebar/FiltersView"
import { DetectionView } from "@/components/sidebar/DetectionView"

import { useMapStore } from "@/store/use-map-store"

export function AppSidebar() {
  const { open, setOpen } = useSidebar()
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
    <div
      className={`
        absolute top-2 left-2 z-50 h-[calc(100vh-3.5rem)] rounded-2xl 
        border border-white/10 border-t-white/20 border-l-white/20 
        bg-background/60 backdrop-blur-xl shadow-lg overflow-hidden pointer-events-auto 
        transition-all duration-300 ease-in-out flex flex-col
        ${open ? "w-64 opacity-100" : "w-0 opacity-0 -translate-x-4 border-none"}
      `}
    >
      <div className='absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

      <div className='p-2 flex items-center justify-end z-10 shrink-0'>
        <SidebarTrigger className='cursor-pointer hover:bg-background/30' onClick={() => setOpen(!open)} />
      </div>

      {open && (
        <div
          className='flex-1 overflow-y-auto min-h-0 z-10
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-white/0
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:border
          [&::-webkit-scrollbar-thumb]:border-transparent
          [&::-webkit-scrollbar-thumb]:bg-clip-padding
          hover:[&::-webkit-scrollbar-thumb]:bg-white/20
          transition-all duration-300'
        >
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
        </div>
      )}
    </div>
  )
}
