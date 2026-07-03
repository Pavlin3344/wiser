import React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/sidebar/AppSidebar"
import { MapContainer } from "@/components/map/MapContainer"
import { TopBar } from "@/components/overlays/TopBar"
import { SecondaryBar } from "@/components/overlays/SecondaryBar"
import { BottomStatusBar } from "@/components/overlays/BottomStatusBar"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { ErrorBoundary } from "@/components/providers/ErrorBoundary"
import { useUIStore } from "@/store/use-ui-store"

interface DashboardLayoutProps {
  children?: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { sidebarOpen, setSidebarOpen } = useUIStore()

  return (
    <ThemeProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <TooltipProvider>
          <AppSidebar />

          <SidebarInset className='absolute inset-0 p-0 overflow-hidden'>
            <ErrorBoundary>
              <MapContainer />
            </ErrorBoundary>

            <TopBar />
            <SecondaryBar />
            <BottomStatusBar />
            {children}
          </SidebarInset>
        </TooltipProvider>
      </SidebarProvider>
    </ThemeProvider>
  )
}
