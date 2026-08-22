import { useEffect, useState } from "react"
import { AlertTriangle, Loader2, Navigation, Sprout } from "lucide-react"

import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { fetchBurnSeverity, type BurnSeverityAnalysis } from "@/services/burnSeverityService"
import { useMapStore } from "@/store/use-map-store"

/** USGS dNBR severity classes, in the order the worker writes their hectare columns. */
const SEVERITY_BANDS = [
  { key: "haRegrowth", label: "Regrowth", color: "#3b82f6" },
  { key: "haUnburned", label: "Unburned", color: "#22c55e" },
  { key: "haLow", label: "Low", color: "#fbbf24" },
  { key: "haModerateLow", label: "Mod-low", color: "#f97316" },
  { key: "haModerateHigh", label: "Mod-high", color: "#dc2626" },
  { key: "haHigh", label: "High", color: "#7f1d1d" },
] as const

const ha = (value: number | null) => (typeof value === "number" ? value.toFixed(1) : "—")

/**
 * Completed post-fire burn severity analyses.
 *
 * The dNBR raster stays in MinIO; what is worth reading on a dashboard is how much
 * burned and how badly, so this shows the summary the worker wrote alongside it.
 */
export function BurnSeverityPanel() {
  const { setFlyToTarget } = useMapStore()

  const [analyses, setAnalyses] = useState<BurnSeverityAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetchBurnSeverity(10)
      .then((data) => {
        if (cancelled) return
        setAnalyses(data)
        setFailed(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn(`[Wiser] Could not load burn severity analyses (${err}).`)
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  /** Centre of the analysed extent, so the map can be sent to what was measured. */
  const flyTo = (analysis: BurnSeverityAnalysis) => {
    const ring = analysis.geom?.coordinates?.[0]
    if (!ring?.length) return
    const lngs = ring.map((p) => p[0])
    const lats = ring.map((p) => p[1])
    setFlyToTarget({
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      zoom: 11,
    })
  }

  return (
    <SidebarGroup className="mt-2 min-h-0">
      <SidebarGroupLabel>
        <div className="w-full flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sprout className="size-3.5" /> Burn Severity
          </span>
          {!loading && !failed && analyses.length > 0 && (
            <Badge variant="outline" className="text-[10px] rounded-full bg-destructive/10 border-destructive text-destructive">
              {analyses.length} dNBR
            </Badge>
          )}
        </div>
      </SidebarGroupLabel>

      <div className="overflow-y-auto px-2 pt-2 space-y-2 no-scrollbar max-h-[calc(100vh-34rem)]">
        {loading && (
          <div className="flex items-center gap-2 justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading analyses...
          </div>
        )}

        {!loading && failed && (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <AlertTriangle className="size-4 text-destructive" />
            <p className="text-xs font-semibold">Analysis feed unavailable</p>
            <p className="text-[10px] text-muted-foreground px-4">The backend did not respond.</p>
          </div>
        )}

        {/* An empty list means the worker has not run over a fire yet, which is a
            different thing from nothing having burned. Say the first, not the second. */}
        {!loading && !failed && analyses.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <Sprout className="size-4 text-emerald-500" />
            <p className="text-xs font-semibold">No analysis computed yet</p>
            <p className="text-[10px] text-muted-foreground px-4">
              Burn severity needs a Sentinel-2 scene from before and after a fire.
            </p>
          </div>
        )}

        {analyses.map((analysis) => {
          const total = SEVERITY_BANDS.reduce((sum, band) => sum + (analysis[band.key] ?? 0), 0)

          return (
            <button
              key={analysis.id}
              onClick={() => flyTo(analysis)}
              className="w-full text-left flex flex-col gap-2 p-3 rounded-2xl bg-background/20 hover:bg-background/40 backdrop-blur-md border border-white/10 border-t-white/20 border-l-white/20 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                  {analysis.preDate} → {analysis.postDate}
                </span>
                <Navigation className="size-3 text-muted-foreground shrink-0" />
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold font-mono text-destructive">{ha(analysis.burnedHectares)}</span>
                <span className="text-[10px] text-muted-foreground">ha burned</span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                  dNBR {analysis.meanDnbr === null ? "—" : analysis.meanDnbr.toFixed(2)}
                </span>
              </div>

              {/* Proportional bar rather than six numbers: the shape of the damage is
                  the point, and the exact hectares are one hover away. */}
              {total > 0 && (
                <div className="flex h-1.5 w-full overflow-hidden rounded-full">
                  {SEVERITY_BANDS.map((band) => {
                    const value = analysis[band.key] ?? 0
                    if (value <= 0) return null
                    return (
                      <span
                        key={band.key}
                        title={`${band.label}: ${ha(analysis[band.key])} ha`}
                        style={{ width: `${(value / total) * 100}%`, backgroundColor: band.color }}
                      />
                    )
                  })}
                </div>
              )}

              <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                <span>of {ha(analysis.analysedHectares)} ha analysed</span>
                {analysis.fireId !== null && <span className="font-mono">fire #{analysis.fireId}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </SidebarGroup>
  )
}
