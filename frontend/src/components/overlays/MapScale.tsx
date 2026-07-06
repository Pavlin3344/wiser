import { useEffect, useState } from "react"
import { type PointLike } from "maplibre-gl"
import { useMapStore } from "@/store/use-map-store"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface MapScaleProps {
  className?: string
  maxWidth?: number
  variant?: "inline" | "floating"
}

function getDecimalRoundNum(d: number): number {
  if (d <= 0) return 0
  const multiplier = Math.pow(10, Math.floor(Math.log10(d)))
  const r = d / multiplier
  let rRound: number
  if (r >= 5) {
    rRound = 5
  } else if (r >= 2) {
    rRound = 2
  } else {
    rRound = 1
  }
  return rRound * multiplier
}

export function MapScale({ className, maxWidth = 80, variant = "inline" }: MapScaleProps) {
  const map = useMapStore((s) => s.mapInstance)
  const [scaleData, setScaleData] = useState<{ label: string; width: number } | null>(null)
  const [unit, setUnit] = useState<"metric" | "imperial">(() => {
    // Try to load initial unit preference from localStorage
    try {
      const saved = localStorage.getItem("wiser-scale-unit")
      if (saved === "metric" || saved === "imperial") return saved
    } catch {
      // Ignore storage errors
    }
    return "metric"
  })

  // Save preference when user toggles
  const handleToggle = () => {
    const nextUnit = unit === "metric" ? "imperial" : "metric"
    setUnit(nextUnit)
    try {
      localStorage.setItem("wiser-scale-unit", nextUnit)
    } catch {
      // Ignore storage errors
    }
  }

  useEffect(() => {
    if (!map) return

    const updateScale = () => {
      // Ensure all required map methods are available (adds resilience for mocked environments in tests)
      if (
        typeof map.getCenter !== "function" ||
        typeof map.project !== "function" ||
        typeof map.unproject !== "function"
      ) {
        return
      }

      const center = map.getCenter()
      if (!center || typeof center.distanceTo !== "function") return

      const centerPx = map.project(center)
      if (!centerPx) return

      // Shift by maxWidth pixels to compute scale
      const edgePx = { x: centerPx.x + maxWidth, y: centerPx.y }
      const edge = map.unproject(edgePx as PointLike)
      if (!edge) return

      // distanceTo returns geodesic distance in meters
      const distanceInMeters = center.distanceTo(edge)
      if (isNaN(distanceInMeters) || distanceInMeters <= 0) return

      let label: string
      let barWidth: number

      if (unit === "metric") {
        const cleanMeters = getDecimalRoundNum(distanceInMeters)
        barWidth = (cleanMeters / distanceInMeters) * maxWidth
        if (cleanMeters >= 1000) {
          label = `${(cleanMeters / 1000).toFixed(0)} km`
        } else {
          label = `${cleanMeters.toFixed(0)} m`
        }
      } else {
        const distanceInFeet = distanceInMeters * 3.28084
        if (distanceInFeet < 5280) {
          const cleanFeet = getDecimalRoundNum(distanceInFeet)
          barWidth = (cleanFeet / distanceInFeet) * maxWidth
          label = `${cleanFeet.toFixed(0)} ft`
        } else {
          const distanceInMiles = distanceInFeet / 5280
          const cleanMiles = getDecimalRoundNum(distanceInMiles)
          barWidth = (cleanMiles / distanceInMiles) * maxWidth
          label = `${cleanMiles.toFixed(0)} mi`
        }
      }

      setScaleData({ label, width: Math.round(barWidth) })
    }

    // Recalculate on any map movement (pan, zoom, pitch, rotate)
    map.on("move", updateScale)
    updateScale()

    return () => {
      map.off("move", updateScale)
    }
  }, [map, unit, maxWidth])

  if (!scaleData) return null

  if (variant === "floating") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleToggle}
            className={cn(
              "pointer-events-auto flex flex-col items-center justify-center bg-background/60 backdrop-blur-xl border border-white/10 border-t-white/20 border-l-white/20 shadow-lg px-3 py-1.5 rounded-full cursor-pointer select-none transition-all hover:bg-muted/80 active:scale-95 duration-150",
              className
            )}
          >
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest leading-none mb-1">
              {scaleData.label}
            </span>
            <div
              className="h-1 border-x border-b border-muted-foreground/60 transition-all duration-75"
              style={{ width: `${scaleData.width}px` }}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side='top' sideOffset={8}>
          Scale: Click to toggle units (currently {unit})
        </TooltipContent>
      </Tooltip>
    )
  }

  // Inline variant
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleToggle}
          className={cn(
            "flex flex-col items-center justify-center cursor-pointer select-none transition-opacity hover:opacity-80 active:scale-95 duration-150 py-0.5",
            className
          )}
        >
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest leading-none mb-1">
            {scaleData.label}
          </span>
          <div
            className="h-1 border-x border-b border-muted-foreground/50 transition-all duration-75"
            style={{ width: `${scaleData.width}px` }}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side='top' sideOffset={8}>
        Scale: Click to toggle units (currently {unit})
      </TooltipContent>
    </Tooltip>
  )
}
