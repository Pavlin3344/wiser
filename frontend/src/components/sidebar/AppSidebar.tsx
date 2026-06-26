import { Map, Flame, LineChart, Bell, Command, Settings } from "lucide-react"

import { SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, Sidebar, SidebarHeader, SidebarFooter, SidebarRail } from "@/components/ui/sidebar"

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
    <Sidebar
      variant='floating'
      collapsible='offcanvas'
      className='
        h-[calc(100vh-2.5rem)]

        [--sidebar-background:transparent]
        [--sidebar-border:transparent]

        [&>div]:bg-background/60
        [&>div]:backdrop-blur-xl
        [&>div]:shadow-lg!
        [&>div]:border
        [&>div]:border-white/10
        [&>div]:border-t-white/20
        [&>div]:border-l-white/20
      '
    >
      <div className='absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none rounded-2xl z-0' />

      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <a href='#'>
                <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
                  <Command className='size-4' />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-medium'>Wiser Core</span>
                  <span className='truncate text-xs'>Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className='text-[10px] uppercase tracking-widest text-muted-foreground'>Dashboard</SidebarGroupLabel>
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

      <SidebarFooter className='p-4 z-10 shrink-0 border-t border-black/5 dark:border-white/5'>
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-2'>
            {/* Pulsing online indicator */}
            <div className='relative flex h-2 w-2'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75'></span>
              <span className='relative inline-flex rounded-full h-2 w-2 bg-emerald-500'></span>
            </div>
            <span className='text-[10px] uppercase tracking-widest text-muted-foreground font-semibold'>System Online</span>
          </div>
          <Settings className='size-4 text-muted-foreground hover:text-foreground cursor-pointer transition-colors' />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
