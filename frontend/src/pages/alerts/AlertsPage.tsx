import React, { useEffect, useState } from "react"
import { AlertTriangle, Flame, Navigation, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchAlerts, fetchActiveFires, type Alert } from "@/services/fireService"
import { useMapStore } from "@/store/use-map-store"
import { useLayerStore } from "@/store/use-layer-store"

/** Where a fire sits on the map, resolved from the active detections feed. */
type FireLocations = Record<number, { lat: number; lng: number }>

export function AlertsPage() {
  const { setFlyToTarget } = useMapStore()
  const { setShowFires } = useLayerStore()

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [fireLocations, setFireLocations] = useState<FireLocations>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [reviewed, setReviewed] = useState<Record<number, boolean>>({})
  const [loadedAt, setLoadedAt] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false

    // Alerts carry a fire_id but no coordinates, so the active detections are used to
    // resolve a location. A missing fire only disables navigation, never the alert.
    Promise.all([fetchAlerts(), fetchActiveFires().catch(() => null)])
      .then(([loadedAlerts, fires]) => {
        if (cancelled) return

        const locations: FireLocations = {}
        for (const feature of fires?.features ?? []) {
          const id = feature.properties?.id
          if (typeof id === "number" && feature.geometry.type === "Point") {
            const [lng, lat] = feature.geometry.coordinates as [number, number]
            locations[id] = { lat, lng }
          }
        }

        setAlerts(loadedAlerts)
        setFireLocations(locations)
        setLoadedAt(Date.now())
        setFailed(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn(`[Wiser] Could not load alerts (${err}).`)
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleFlyTo = (alert: Alert) => {
    const location = alert.fireId !== null ? fireLocations[alert.fireId] : undefined
    if (!location) {
      toast.info("No map location for this alert", {
        description: "Its fire is not among the current active detections.",
      })
      return
    }

    setShowFires(true)
    setFlyToTarget({ lat: location.lat, lng: location.lng, zoom: 12 })
    toast.success("Navigating to alert", {
      description: `Coordinates: ${location.lat.toFixed(4)}° N, ${location.lng.toFixed(4)}° E`,
    })
  }

  // Session-local on purpose. The alerts table has an acknowledged_at column but no
  // endpoint writes it yet, so this must not look like it dispatched anyone.
  const toggleReviewed = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !reviewed[id]
    setReviewed((prev) => ({ ...prev, [id]: next }))
    toast.info(next ? "Marked as reviewed (this session only)" : "Review mark removed")
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/25 animate-pulse"
      case "high":
        return "bg-orange-500/10 border-orange-500/30 text-orange-500 hover:bg-orange-500/25"
      case "medium":
        return "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/25"
      default:
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/25"
    }
  }

  // Anchored to when the feed was loaded rather than read during render: calling
  // Date.now() while rendering is an impure read, and the label would drift anyway.
  const relativeTime = (iso: string) => {
    const minutes = Math.round((loadedAt - new Date(iso).getTime()) / 60_000)
    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.round(hours / 24)}d ago`
  }

  return (
    <SidebarGroup className="min-h-0">
      <SidebarGroupLabel>
        <div className="w-full flex items-center justify-between">
          <span>System Alerts</span>
          {!loading && !failed && (
            <Badge variant="outline" className="text-[10px] bg-destructive/10 border-destructive text-destructive">
              {alerts.length} ACTIVE
            </Badge>
          )}
        </div>
      </SidebarGroupLabel>

      <div className="overflow-y-auto px-2 pt-3 space-y-2 no-scrollbar rounded-2xl max-h-[calc(100vh-28rem)]">
        {loading && (
          <div className="flex items-center gap-2 justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading alerts...
          </div>
        )}

        {!loading && failed && (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <AlertTriangle className="size-4 text-destructive" />
            <p className="text-xs font-semibold">Alert feed unavailable</p>
            <p className="text-[10px] text-muted-foreground px-4">
              The backend did not respond, so this list is not a picture of current risk.
            </p>
          </div>
        )}

        {!loading && !failed && alerts.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <p className="text-xs font-semibold">No active alerts</p>
            <p className="text-[10px] text-muted-foreground px-4">
              No fire has been detected near tracked critical infrastructure.
            </p>
          </div>
        )}

        {alerts.map((alert) => {
          const isReviewed = reviewed[alert.id]
          const severityStyles = getSeverityStyles(alert.severity)
          const hasLocation = alert.fireId !== null && fireLocations[alert.fireId] !== undefined

          return (
            <div
              key={alert.id}
              onClick={() => handleFlyTo(alert)}
              className={`
                group/alert relative flex flex-col gap-2 p-3 text-left transition-all duration-300 cursor-pointer
                bg-background/20 hover:bg-background/40 backdrop-blur-md rounded-2xl
                border border-white/10 border-t-white/20 border-l-white/20
                shadow-sm hover:shadow-md
                ${isReviewed ? "ring-1 ring-emerald-500/40 border-emerald-500/30" : ""}
              `}
            >
              <div className="flex gap-2.5 items-start">
                <div className={`p-2 rounded-xl shrink-0 ${severityStyles}`}>
                  <Flame className="size-3 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5 gap-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                      {alert.targetType ?? alert.alertType}
                    </span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{relativeTime(alert.sentAt)}</span>
                  </div>
                  <p className="text-xs font-bold text-foreground truncate group-hover/alert:text-destructive transition-colors">
                    {alert.message ?? `${alert.alertType} alert`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`capitalize h-4 px-1 text-[9px] font-bold border-none rounded-full ${severityStyles}`}>
                    {alert.severity}
                  </Badge>
                  {isReviewed && (
                    <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold bg-emerald-500/10 border-none text-emerald-500 rounded-full flex items-center gap-0.5">
                      <CheckCircle2 className="size-2.5" /> Reviewed
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-60 group-hover/alert:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`size-6 rounded-md hover:bg-background/40 ${isReviewed ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500"}`}
                    onClick={(e) => toggleReviewed(alert.id, e)}
                    title="Mark as reviewed"
                  >
                    <ShieldAlert className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!hasLocation}
                    className="size-6 rounded-md hover:bg-background/40 text-muted-foreground hover:text-sky-500 disabled:opacity-30"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFlyTo(alert)
                    }}
                    title={hasLocation ? "Show on map" : "Fire not among current detections"}
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
