import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/sidebar/AppSidebar"
import { MapContainer } from "@/components/map/MapContainer"
import { TopBar } from "@/components/overlays/TopBar"
import { SecondaryBar } from "@/components/overlays/SecondaryBar"
import { BottomStatusBar } from "@/components/overlays/BottomStatusBar"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { useMapStore } from "@/store/use-map-store"

function App() {
  const { sidebarOpen, setSidebarOpen } = useMapStore()

  return (
    <ThemeProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <TooltipProvider>
          <AppSidebar />

          <SidebarInset className='absolute inset-0 p-0 overflow-hidden'>
            <MapContainer />

            <TopBar />
            <SecondaryBar />
            <BottomStatusBar />
          </SidebarInset>
        </TooltipProvider>
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default App
