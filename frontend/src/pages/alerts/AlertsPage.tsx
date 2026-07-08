import React, { useState } from "react"
import { AlertTriangle, Flame, Navigation, Volume2, VolumeX, ShieldAlert, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { mockFireData } from "@/mocks/fire-data"
import { useMapStore } from "@/store/use-map-store"
import { useLayerStore } from "@/store/use-layer-store"

export function AlertsPage() {
  const { setFlyToTarget } = useMapStore()
  const { setShowFires } = useLayerStore()
  const [mutedAlerts, setMutedAlerts] = useState<Record<string, boolean>>({})
  const [dispatchedAlerts, setDispatchedAlerts] = useState<Record<string, boolean>>({})

  const fireAlerts = mockFireData.features.map((feature, index) => {
    const coords = feature.geometry.type === "Point" ? (feature.geometry.coordinates as [number, number]) : [0, 0]
    const props = feature.properties || {}
    const intensity = props.intensity || "moderate"
    const title = props.title || `Ignition Detected #${index + 1}`

    const sector = coords[0] > 0
      ? (coords[0] > 25.5 ? "Eastern Sector" : coords[0] < 22 ? "Southern Sector" : "Central Sector")
      : "Pacific Range"

    return {
      id: `fire-${index}`,
      title,
      sector,
      intensity,
      lat: coords[1],
      lng: coords[0],
      time: "Active Now",
      type: "fire",
    }
  })

  const allAlerts = [
    ...fireAlerts,
    {
      id: "sys-1",
      title: "Weather Station Telemetry Lag",
      sector: "Rila Peak (Station W-09)",
      intensity: "moderate",
      lat: 42.17,
      lng: 23.58,
      time: "45 mins ago",
      type: "system",
    }
  ]

  const handleFlyTo = (alert: typeof allAlerts[0]) => {
    // If it's a fire alert, make sure the fire layer is active so they can see the marker!
    if (alert.type === "fire") {
      setShowFires(true)
    }
    setFlyToTarget({ lat: alert.lat, lng: alert.lng, zoom: 12 })
    toast.success(`Navigating to ${alert.title}`, {
      description: `Coordinates: ${alert.lat.toFixed(4)}° N, ${alert.lng.toFixed(4)}° E`,
    })
  }

  const toggleMute = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMutedAlerts(prev => {
      const updated = { ...prev, [id]: !prev[id] }
      if (updated[id]) {
        toast.info("Audio notifications muted for this alert")
      } else {
        toast.info("Audio notifications unmuted for this alert")
      }
      return updated
    })
  }

  const handleDispatch = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDispatchedAlerts(prev => {
      const updated = { ...prev, [id]: !prev[id] }
      if (updated[id]) {
        toast.success(`Emergency dispatched for: ${title}`, {
          icon: <ShieldAlert className="text-destructive size-4" />,
        })
      } else {
        toast.info(`Emergency response stand-down for: ${title}`)
      }
      return updated
    })
  }

  const getIntensityStyles = (intensity: string) => {
    switch (intensity) {
      case "critical":
        return "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/25 animate-pulse"
      case "high":
        return "bg-orange-500/10 border-orange-500/30 text-orange-500 hover:bg-orange-500/25"
      case "moderate":
        return "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/25"
      default:
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/25"
    }
  }

  return (
    <SidebarGroup className="min-h-0">

      <SidebarGroupLabel>
        <div className="w-full flex items-center justify-between">
          <span>System Alerts</span>
          <Badge variant="outline" className="text-[10px] bg-destructive/10 border-destructive text-destructive">
            <span className="animate-pulse">{allAlerts.length} LIVE</span>
          </Badge>
        </div>
      </SidebarGroupLabel>

      <div className="overflow-y-auto px-2 pt-3 space-y-2 no-scrollbar rounded-2xl max-h-[calc(100vh-28rem)]">
        {allAlerts.map((alert) => {
          const isDispatched = dispatchedAlerts[alert.id]
          const isMuted = mutedAlerts[alert.id]
          const severityStyles = getIntensityStyles(alert.intensity)

          return (
            <div
              key={alert.id}
              onClick={() => handleFlyTo(alert)}
              className={`
                group/alert relative flex flex-col gap-2 p-3 text-left transition-all duration-300 cursor-pointer
                bg-background/20 hover:bg-background/40 backdrop-blur-md rounded-2xl
                border border-white/10 border-t-white/20 border-l-white/20
                shadow-sm hover:shadow-md
                ${isDispatched ? "ring-1 ring-emerald-500/40 border-emerald-500/30" : ""}
              `}
            >
              <div className="flex gap-2.5 items-start">
                <div className={`p-2 rounded-xl shrink-0 ${severityStyles}`}>
                  {alert.type === "fire" ? (
                    <Flame className="size-3 animate-pulse text-red-500" />
                  ) : (
                    <AlertTriangle className="size-3 text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                      {alert.sector}
                    </span>
                    <span className="text-[9px] text-muted-foreground">•</span>
                    <span className="text-[9px] text-muted-foreground truncate">{alert.time}</span>
                  </div>
                  <p className="text-xs font-bold text-foreground truncate group-hover/alert:text-destructive transition-colors">
                    {alert.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`capitalize h-4 px-1 text-[9px] font-bold border-none rounded-full ${severityStyles}`}>
                    {alert.intensity}
                  </Badge>
                  {!isDispatched && alert.intensity === "critical" && (
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </div>
                  )}
                  {isDispatched && (
                    <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold bg-emerald-500/10 border-none text-emerald-500 rounded-full flex items-center gap-0.5 animate-in fade-in zoom-in-95 duration-200">
                      <CheckCircle2 className="size-2.5" /> Dispatched
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-60 group-hover/alert:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 rounded-md hover:bg-background/40 hover:text-foreground text-muted-foreground"
                    onClick={(e) => toggleMute(alert.id, e)}
                  >
                    {isMuted ? <VolumeX className="size-3.5 text-red-500" /> : <Volume2 className="size-3.5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`size-6 rounded-md hover:bg-background/40 ${isDispatched ? "text-emerald-500" : "text-muted-foreground hover:text-destructive"}`}
                    onClick={(e) => handleDispatch(alert.id, alert.title, e)}
                  >
                    <ShieldAlert className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 rounded-md hover:bg-background/40 text-muted-foreground hover:text-sky-500"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFlyTo(alert)
                    }}
                  >
                    <Navigation className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </SidebarGroup>
  )
}
