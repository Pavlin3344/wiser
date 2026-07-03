import { useEffect, useRef, useState } from "react"
import { Map, Flame, LineChart, Bell, MoreHorizontal, Sun, Moon, LifeBuoy, Send, Download, Smartphone, Crosshair, Mountain, Search, X } from "lucide-react"

import { useUIStore } from "@/store/use-ui-store"
import { useSidebar } from "@/components/ui/sidebar"
import { useMapStore } from "@/store/use-map-store"
import { usePWAInstall } from "@/hooks/use-pwa-install"

import { AnalysisPage } from "@/pages/phase3/AnalysisPage"
import { AlertsPage } from "@/pages/alerts/AlertsPage"
import { RiskAssessmentPage } from "@/pages/phase1/RiskAssessmentPage"
import { DetectionPage } from "@/pages/phase2/DetectionPage"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

function MobileTelemetry() {
  const coordsRef = useRef<HTMLSpanElement>(null)
  const elevationRef = useRef<HTMLSpanElement>(null)
  const zoomRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const unsub = useMapStore.subscribe(
      (s) => s.mapStatus,
      ({ lat, lng, elevation, zoom }) => {
        if (coordsRef.current) coordsRef.current.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`
        if (elevationRef.current) elevationRef.current.textContent = `${elevation}m ASL`
        if (zoomRef.current) zoomRef.current.textContent = `ZOOM: ${zoom.toFixed(1)}`
      },
    )
    return unsub
  }, [])

  return (
    <div className='grid grid-cols-3 gap-2 p-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-mono text-muted-foreground uppercase tracking-wider'>
      <div className='flex flex-col items-center gap-1 text-center'>
        <Crosshair className='size-3.5 text-destructive' />
        <span ref={coordsRef} className="truncate w-full">0.0000° N, 0.0000° E</span>
      </div>
      <div className='flex flex-col items-center gap-1 text-center border-x border-white/5'>
        <Mountain className='size-3.5 text-destructive' />
        <span ref={elevationRef} className="truncate w-full">0m ASL</span>
      </div>
      <div className='flex flex-col items-center gap-1 text-center'>
        <Search className='size-3.5 text-destructive' />
        <span ref={zoomRef} className="truncate w-full">ZOOM: 7.0</span>
      </div>
    </div>
  )
}

function MoreTabContent() {
  const { theme, setTheme } = useUIStore()
  const { installPrompt, isStandalone, isIOS, install } = usePWAInstall()

  return (
    <div className="space-y-4 px-4 py-2 text-foreground">
      <div>
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">System Telemetry</h4>
        <MobileTelemetry />
      </div>

      <div className="border-t border-white/10 pt-3">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Preferences</h4>
        <div className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/10">
          <span className="text-xs font-semibold">Theme Mode</span>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/60 border border-white/10 text-xs font-semibold cursor-pointer text-foreground hover:bg-muted/80 transition-colors"
          >
            {theme === "dark" ? (
              <>
                <Sun className="size-3.5 text-yellow-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="size-3.5 text-slate-700" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="border-t border-white/10 pt-3">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Application</h4>
        <div className="flex flex-col gap-2">
          {installPrompt && (
            <button
              onClick={install}
              className="flex w-full items-center justify-center gap-2 h-9 rounded-xl bg-destructive hover:bg-destructive/90 text-primary-foreground text-xs font-bold transition-all cursor-pointer animate-pulse"
            >
              <Download className="size-4" />
              <span>Install Wiser Core App</span>
            </button>
          )}

          {isIOS && !isStandalone && (
            <Dialog>
              <DialogTrigger asChild>
                <button className="flex w-full items-center justify-center gap-2 h-9 rounded-xl bg-destructive hover:bg-destructive/90 text-primary-foreground text-xs font-bold transition-all cursor-pointer">
                  <Smartphone className="size-4" />
                  <span>Install on iOS</span>
                </button>
              </DialogTrigger>
              <DialogContent className='bg-background/80 backdrop-blur-xl border border-white/10 border-t-white/20 border-l-white/20 shadow-lg rounded-2xl p-6 text-foreground max-w-xs'>
                <DialogHeader>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <Smartphone className="text-destructive size-4" /> Install Wiser Core
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground pt-1">
                    Add Wiser Core to your home screen to use it as a standalone full screen app.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 my-2 text-xs">
                  <div className="flex gap-3 items-start">
                    <div className="flex items-center justify-center size-5 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold shrink-0 mt-0.5">1</div>
                    <p>Open this dashboard in the <strong>Safari</strong> app.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex items-center justify-center size-5 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold shrink-0 mt-0.5">2</div>
                    <p>Tap the <strong>Share</strong> button (square with an up arrow) in the Safari toolbar.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex items-center justify-center size-5 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold shrink-0 mt-0.5">3</div>
                    <p>Scroll down the list and select <strong>"Add to Home Screen"</strong>.</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <div className="grid grid-cols-2 gap-2">
            <a
              href="#"
              className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-muted/20 text-xs font-semibold transition-all text-center"
            >
              <LifeBuoy className="size-3.5 text-muted-foreground" />
              <span>Support</span>
            </a>
            <a
              href="#"
              className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-muted/20 text-xs font-semibold transition-all text-center"
            >
              <Send className="size-3.5 text-muted-foreground" />
              <span>Feedback</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MobileNavBar() {
  const { isMobile } = useSidebar()
  const { activeSidebarTab, setActiveSidebarTab } = useUIStore()
  const [activeTab, setActiveTab] = useState<string | null>(null)

  if (!isMobile) return null

  const handleTabClick = (tabId: string) => {
    if (activeTab === tabId) {
      setActiveTab(null)
    } else {
      setActiveTab(tabId)
      if (tabId !== "more") {
        setActiveSidebarTab(tabId as any)
      }
    }
  }

  const tabContent = (() => {
    switch (activeTab) {
      case "risk": return <RiskAssessmentPage />
      case "detection": return <DetectionPage />
      case "analysis": return <AnalysisPage />
      case "alerts": return <AlertsPage />
      case "more": return <MoreTabContent />
      default: return null
    }
  })()

  const tabTitle = (() => {
    switch (activeTab) {
      case "risk": return "Risk Assessment"
      case "detection": return "Detection Panel"
      case "analysis": return "Analysis & Trends"
      case "alerts": return "System Alerts"
      case "more": return "System Control"
      default: return ""
    }
  })()

  const tabs = [
    { id: "risk", label: "Risk", Icon: Map },
    { id: "detection", label: "Detection", Icon: Flame },
    { id: "analysis", label: "Analysis", Icon: LineChart },
    { id: "alerts", label: "Alerts", Icon: Bell },
    { id: "more", label: "More", Icon: MoreHorizontal },
  ]

  return (
    <>
      {/* Floating Bottom Nav Bar */}
      <div className="fixed bottom-4 left-8 right-8 h-14 bg-background/60 backdrop-blur-xl border border-white/10 border-t-white/20 border-l-white/20 rounded-full shadow-2xl z-40 flex items-center justify-around px-2 pointer-events-auto">
        <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none rounded-full" />

        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-200 cursor-pointer ${isActive ? "text-destructive scale-105 font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Icon className="size-5" />
              <span className="text-[9px] font-semibold mt-0.5 tracking-wider uppercase">{label}</span>
              {isActive && (
                <div className="absolute -bottom-1 size-1 bg-destructive rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Bottom Sheet Drawer for Selected Tab Content */}
      <Sheet open={activeTab !== null} onOpenChange={(open) => { if (!open) setActiveTab(null) }}>
        <SheetContent
          side="bottom"
          className="bg-background/80 backdrop-blur-xl border-t border-white/10 rounded-t-3xl max-h-[70vh] pb-4 overflow-y-auto w-full max-w-lg mx-auto [&>button]:hidden px-2 outline-none"
        >
          {/* Drag Handle */}
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto my-3" />

          <SheetHeader className="px-4 flex flex-row items-center justify-between space-y-0 pb-2">
            <SheetTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{tabTitle}</SheetTitle>
            <button
              onClick={() => setActiveTab(null)}
              className="p-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </SheetHeader>

          <SheetDescription className="sr-only">
            Displays content for the {tabTitle} tab.
          </SheetDescription>

          <div className="mt-2 overflow-y-auto">
            {tabContent}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
