import { useEffect, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertTriangle, Loader2, MapPin, Wind } from "lucide-react"

import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import {
  fetchAirQualityHistory,
  fetchLatestAirQuality,
  type AirQualityAverage,
  type AirQualityReading,
} from "@/services/airQualityService"
import { eaqiBand, type EAQIBand } from "@/utils/helpers"
import { useMapStore } from "@/store/use-map-store"

/** Particulates are what smoke plumes carry, so they are the two plotted series. */
const PM25_COLOR = "#f59e0b" // amber-500
const PM10_COLOR = "#38bdf8" // sky-400

const RANGES = [
  { hours: 24, label: "24h" },
  { hours: 168, label: "7d" },
] as const

type Pollutant = "pm25" | "pm10" | "no2" | "co"

/** Country-wide mean, ignoring points the upstream model left blank. */
function average(readings: AirQualityReading[], pollutant: Pollutant): number | null {
  const values = readings.map((r) => r[pollutant]).filter((v): v is number => typeof v === "number")
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function format(value: number | null, digits: number): string {
  return value === null ? "—" : value.toFixed(digits)
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number | null; dataKey: string; color: string }>
  label?: string
}

const ChartTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background/20 backdrop-blur-sm border border-white/10 border-t-white/20 border-l-white/20 p-3 rounded-2xl shadow-lg">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-xs font-medium flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="uppercase text-[10px] text-muted-foreground">
            {entry.dataKey === "pm25" ? "PM2.5" : "PM10"}
          </span>
          <span className="font-mono">{entry.value === null ? "—" : entry.value.toFixed(1)} µg/m³</span>
        </p>
      ))}
    </div>
  )
}

/**
 * Pollutant readings sampled across Bulgaria. Shown as numbers plus a trend rather
 * than as a map layer: a 5x4 grid is far too coarse to draw as a surface, and the
 * question operators ask during a fire is how the air changed over the last hours.
 */
export function AirQualityPanel() {
  const { setFlyToTarget } = useMapStore()

  const [readings, setReadings] = useState<AirQualityReading[]>([])
  const [history, setHistory] = useState<AirQualityAverage[]>([])
  const [hours, setHours] = useState<number>(24)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [trendFailed, setTrendFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetchLatestAirQuality()
      .then((data) => {
        if (cancelled) return
        setReadings(data)
        setFailed(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn(`[Wiser] Could not load air quality readings (${err}).`)
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchAirQualityHistory(hours)
      .then((data) => {
        if (cancelled) return
        setHistory(data)
        setTrendFailed(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn(`[Wiser] Could not load air quality history (${err}).`)
        setTrendFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [hours])

  const means: Record<Pollutant, number | null> = {
    pm25: average(readings, "pm25"),
    pm10: average(readings, "pm10"),
    no2: average(readings, "no2"),
    co: average(readings, "co"),
  }

  // The European index takes the worst of its sub-indices, so the headline band is
  // the worst pollutant rather than an average of the three.
  const overall = [eaqiBand("pm25", means.pm25), eaqiBand("pm10", means.pm10), eaqiBand("no2", means.no2)]
    .filter((band): band is EAQIBand => band !== null)
    .reduce<EAQIBand | null>((worst, band) => (worst === null || band.level > worst.level ? band : worst), null)

  // Highlights where the air is worst, which is rarely where the country mean sits.
  const hotspot = readings.reduce<AirQualityReading | null>(
    (worst, reading) =>
      typeof reading.pm25 === "number" && (worst === null || reading.pm25 > (worst.pm25 ?? 0)) ? reading : worst,
    null,
  )

  const observedAt = readings.reduce<string | null>(
    (newest, reading) =>
      newest === null || Date.parse(reading.time) > Date.parse(newest) ? reading.time : newest,
    null,
  )

  const chartData = history.map((entry) => ({
    name:
      hours <= 24
        ? new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : new Date(entry.time).toLocaleDateString([], { day: "2-digit", month: "2-digit" }),
    pm25: entry.pm25,
    pm10: entry.pm10,
  }))

  const tile = (label: string, value: number | null, digits: number, band: EAQIBand | null) => (
    <div className="bg-background/20 backdrop-blur-md rounded-2xl p-2 border border-white/10 border-t-white/20 border-l-white/20 flex flex-col items-center justify-center">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-mono font-semibold ${band?.text ?? "text-foreground"}`}>
        {format(value, digits)}
      </span>
      <span className="text-[9px] text-muted-foreground">µg/m³</span>
    </div>
  )

  return (
    <>
      <SidebarGroup className="mt-2">
        <SidebarGroupLabel>
          <div className="w-full flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Wind className="size-3.5" /> Air Quality
            </span>
            {overall && (
              <Badge variant="outline" className={`text-[10px] rounded-full ${overall.bg} ${overall.border} ${overall.text}`}>
                {overall.label}
              </Badge>
            )}
          </div>
        </SidebarGroupLabel>

        <div className="px-2 py-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading readings...
            </div>
          ) : failed ? (
            <div className="flex flex-col items-center gap-1 py-6 text-center">
              <AlertTriangle className="size-4 text-destructive" />
              <p className="text-xs font-semibold">Air quality feed unavailable</p>
              <p className="text-[10px] text-muted-foreground px-4">The backend did not respond.</p>
            </div>
          ) : readings.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-6 text-center">
              <Wind className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold">No readings in the last 24 hours</p>
              <p className="text-[10px] text-muted-foreground px-4">
                The hourly sampling run has not stored anything yet.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {tile("PM2.5", means.pm25, 1, eaqiBand("pm25", means.pm25))}
                {tile("PM10", means.pm10, 1, eaqiBand("pm10", means.pm10))}
                {tile("NO₂", means.no2, 1, eaqiBand("no2", means.no2))}
                {/* The European index defines no CO band, so this one stays uncoloured. */}
                {tile("CO", means.co, 0, null)}
              </div>

              {hotspot && typeof hotspot.pm25 === "number" && (
                <button
                  onClick={() => setFlyToTarget({ lat: hotspot.lat, lng: hotspot.lon, zoom: 9 })}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-background/20 hover:bg-background/40 backdrop-blur-md border border-white/10 border-t-white/20 border-l-white/20 transition-colors cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="size-3" /> Highest PM2.5
                  </span>
                  <span className={`text-[10px] font-mono ${eaqiBand("pm25", hotspot.pm25)?.text ?? "text-foreground"}`}>
                    {hotspot.pm25.toFixed(1)} @ {hotspot.lat.toFixed(2)}°N {hotspot.lon.toFixed(2)}°E
                  </span>
                </button>
              )}

              <p className="text-[10px] text-muted-foreground px-1">
                Country-wide mean of {readings.length} sampling point{readings.length > 1 ? "s" : ""}
                {observedAt ? `, measured ${new Date(observedAt).toLocaleString()}` : ""}.
              </p>
            </>
          )}
        </div>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>
          <div className="w-full flex items-center justify-between">
            <span>Particulate Trend</span>
            <div className="flex items-center bg-background/20 backdrop-blur-sm border border-white/10 border-t-white/20 border-l-white/20 rounded-full p-1">
              {RANGES.map((range) => (
                <button
                  key={range.hours}
                  onClick={() => setHours(range.hours)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                    hours === range.hours
                      ? "bg-destructive text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </SidebarGroupLabel>

        <div className="px-2 py-3 h-40 w-full">
          {trendFailed ? (
            <div className="h-full flex flex-col items-center justify-center gap-1 text-center">
              <AlertTriangle className="size-4 text-destructive" />
              <p className="text-xs font-semibold">Trend data unavailable</p>
              <p className="text-[10px] text-muted-foreground px-4">The backend did not respond.</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" /> Loading trend...
                </span>
              ) : (
                "No readings recorded for this period."
              )}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="areaPm25" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PM25_COLOR} stopOpacity={0.7} />
                    <stop offset="95%" stopColor={PM25_COLOR} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="areaPm10" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PM10_COLOR} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={PM10_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" minTickGap={24} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} width={24} stroke="var(--muted-foreground)" />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Area type="monotone" dataKey="pm10" stroke={PM10_COLOR} strokeWidth={1.5} fill="url(#areaPm10)" connectNulls />
                <Area type="monotone" dataKey="pm25" stroke={PM25_COLOR} strokeWidth={1.5} fill="url(#areaPm25)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="px-4 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: PM25_COLOR }} /> PM2.5
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: PM10_COLOR }} /> PM10
          </span>
          <span className="ml-auto">Hourly average, µg/m³</span>
        </div>
      </SidebarGroup>
    </>
  )
}
