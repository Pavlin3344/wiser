import { useEffect, useState } from "react"
import { Bar, BarChart, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Flame, Loader2, AlertTriangle } from "lucide-react"

import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { fetchDailyFireCounts } from "@/services/fireService"

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className='bg-background/20 backdrop-blur-sm border border-white/10 border-t-white/20 border-l-white/20 p-3 rounded-2xl shadow-lg'>
        <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1'>{label}</p>
        <p className='text-sm font-bold text-destructive flex items-center gap-1'>
          <Flame className="size-3.5" />
          <span className='text-xs font-medium text-foreground'>{payload[0].value} Fire Incidents</span>
        </p>
      </div>
    )
  }
  return null
}

interface ChartPoint {
  name: string
  fires: number
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function AnalysisPage() {
  const [chartType, setChartType] = useState<"bar" | "area">("bar")
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetchDailyFireCounts(7)
      .then((counts) => {
        if (cancelled) return
        setData(counts.map((entry) => ({
          name: WEEKDAYS[new Date(entry.day).getDay()],
          fires: entry.count,
        })))
        setFailed(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn(`[Wiser] Could not load fire trends (${err}).`)
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const totalFires = data.reduce((acc, curr) => acc + curr.fires, 0)
  const maxFires = data.length > 0 ? Math.max(...data.map((d) => d.fires)) : 0
  const peakDay = data.find((d) => d.fires === maxFires && maxFires > 0)?.name

  return (
    <div>
      <SidebarGroup className="space-y-4">
        <SidebarGroupLabel>Weekly Fire Information</SidebarGroupLabel>
        <div className="grid grid-cols-2 gap-2 px-2 text-xs font-mono leading-5">
          <div className="bg-background/20 backdrop-blur-md rounded-2xl p-2 border border-white/10 border-t-white/20 border-l-white/20 flex flex-col justify-center">
            <span className="text-muted-foreground uppercase flex items-center justify-center">
              Total
            </span>
            <span className="text-foreground text-center">
              {loading ? "-" : totalFires}
            </span>
            <span className="text-muted-foreground text-center text-[10px]">
              Last 7 days
            </span>
          </div>

          <div className="bg-background/20 backdrop-blur-md rounded-2xl p-2 border border-white/10 border-t-white/20 border-l-white/20 flex flex-col justify-center">
            <span className="text-muted-foreground uppercase flex items-center justify-center">
              Peak
            </span>
            <span className="text-foreground text-center">
              {loading ? "-" : maxFires}
            </span>
            <span className="text-muted-foreground text-center text-[10px]">
              {peakDay ? `on ${peakDay}` : "Incidents"}
            </span>
          </div>
        </div>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>
          <div className="w-full flex items-center justify-between">
            <span>Weekly Fire Analysis</span>
            <div className="flex items-center bg-background/20 backdrop-blur-sm border border-white/10 border-t-white/20 border-l-white/20 rounded-full p-1">
              <button
                onClick={() => setChartType("bar")}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${chartType === "bar" ? "bg-destructive text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Bar
              </button>
              <button
                onClick={() => setChartType("area")}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${chartType === "area" ? "bg-destructive text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Area
              </button>
            </div>
          </div>
        </SidebarGroupLabel>

        <div className='px-2 py-4 h-48 w-full'>
          {loading ? (
            <div className="h-full flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading trends...
            </div>
          ) : failed ? (
            <div className="h-full flex flex-col items-center justify-center gap-1 text-center">
              <AlertTriangle className="size-4 text-destructive" />
              <p className="text-xs font-semibold">Trend data unavailable</p>
              <p className="text-[10px] text-muted-foreground px-4">The backend did not respond.</p>
            </div>
          ) : (
            <ResponsiveContainer width='100%' height='100%'>
              {chartType === "bar" ? (
                <BarChart data={data}>
                  <XAxis dataKey='name' fontSize={10} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} width={20} stroke='var(--muted-foreground)' allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey='fires' fill='var(--destructive)' radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="areaFires" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey='name' fontSize={10} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} width={20} stroke='var(--muted-foreground)' allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)" }} />
                  <Area type="monotone" dataKey="fires" stroke="var(--destructive)" strokeWidth={1.5} fill="url(#areaFires)" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        <div className='px-4 text-xs text-muted-foreground'>
          {loading || failed
            ? "Detections recorded over the last 7 days."
            : totalFires === 0
              ? "No detections recorded in the last 7 days."
              : `${totalFires} detection${totalFires > 1 ? "s" : ""} over the last 7 days${peakDay ? `, peaking on ${peakDay}` : ""}.`}
        </div>
      </SidebarGroup>
    </div>
  )
}
