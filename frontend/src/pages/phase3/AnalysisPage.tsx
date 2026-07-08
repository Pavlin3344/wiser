import { useState } from "react"
import { Bar, BarChart, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { TrendingUp, Flame, AlertCircle } from "lucide-react"

import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { mockChartData } from "@/mocks/chart-data"

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div>
        <div className='bg-background/80 backdrop-blur-xl border border-white/10 border-t-white/20 border-l-white/20 p-2.5 rounded-xl shadow-lg text-left relative z-50'>
          <p className='text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1'>{label}</p>
          <p className='text-xs font-bold text-destructive flex items-center gap-1'>
            <Flame className="size-3.5" />
            <span>{payload[0].value} Detections</span>
          </p>
        </div>

        <div className='bg-background/20 backdrop-blur-sm border border-white/10 border-t-white/20 border-l-white/20 p-3 rounded-2xl shadow-lg'>
          <p className='text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1'>{label}</p>
          <p className='text-sm font-bold text-destructive'>
            {payload[0].value} <span className='text-xs font-medium text-foreground'>Fire Incidents</span>
          </p>
        </div>
      </div>
    )
  }
  return null
}

export function AnalysisPage() {
  const [chartType, setChartType] = useState<"bar" | "area">("bar")

  // Simple aggregation for KPIs
  const totalFires = mockChartData.reduce((acc, curr) => acc + curr.fires, 0)
  const maxFires = Math.max(...mockChartData.map(d => d.fires))

  return (
    <div>
      <SidebarGroup className="space-y-4">
        <div className="flex items-center justify-between px-4 pb-2 border-b border-border/10">
          <SidebarGroupLabel className="p-0">Weekly Fire Analysis</SidebarGroupLabel>
          <div className="flex items-center bg-background/20 backdrop-blur-sm border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setChartType("bar")}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${chartType === "bar" ? "bg-destructive text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Bar
            </button>
            <button
              onClick={() => setChartType("area")}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${chartType === "area" ? "bg-destructive text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Area
            </button>
          </div>
        </div>

        {/* KPI Overviews */}
        <div className="grid grid-cols-3 gap-2 px-4">
          <div className="bg-background/20 backdrop-blur-md rounded-xl p-2 border border-white/5 flex flex-col justify-center">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
              Total
            </span>
            <span className="font-mono text-sm font-bold text-foreground leading-none">
              {totalFires}
            </span>
            <span className="text-[8px] font-bold text-emerald-500 mt-1 flex items-center gap-0.5 leading-none">
              <TrendingUp className="size-2" /> +12%
            </span>
          </div>

          <div className="bg-background/20 backdrop-blur-md rounded-xl p-2 border border-white/5 flex flex-col justify-center">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
              Peak
            </span>
            <span className="font-mono text-sm font-bold text-foreground leading-none">
              {maxFires}
            </span>
            <span className="text-[8px] text-muted-foreground mt-1 leading-none">
              Incidents
            </span>
          </div>

          <div className="bg-background/20 backdrop-blur-md rounded-xl p-2 border border-white/5 flex flex-col justify-center relative overflow-hidden">
            {/* Pulse dot in background */}
            <div className="absolute top-1 right-1 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
              Critical
            </span>
            <span className="font-mono text-sm font-bold text-destructive leading-none">
              3
            </span>
            <span className="text-[8px] text-red-500/80 font-semibold mt-1 leading-none">
              Active
            </span>
          </div>
        </div>

        {/* Recharts chart */}
        <div className='px-4 h-40 w-full relative z-0'>
          <ResponsiveContainer width='100%' height='100%'>
            {chartType === "bar" ? (
              <BarChart data={mockChartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="barFires" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey='name' fontSize={9} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
                <YAxis fontSize={9} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey='fires' fill='url(#barFires)' radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={mockChartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="areaFires" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey='name' fontSize={9} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
                <YAxis fontSize={9} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="fires" stroke="var(--destructive)" strokeWidth={1.5} fill="url(#areaFires)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className='px-4 text-[10px] text-muted-foreground leading-normal flex items-start gap-1'>
          <AlertCircle className="size-3 text-amber-500 shrink-0 mt-0.5" />
          <span>Peak activity detected on Saturday. Focus response efforts in Eastern and Central sectors.</span>
        </div>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Weekly Fire Analysis</SidebarGroupLabel>
        <div className='px-4 py-4 h-48 w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            {chartType === "bar" ? (
              <BarChart data={mockChartData}>
                <XAxis dataKey='name' fontSize={10} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
                <YAxis fontSize={10} tickLine={false} axisLine={false} width={20} stroke='var(--muted-foreground)' />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey='fires' fill='var(--destructive)' radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={mockChartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="areaFires" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey='name' fontSize={9} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
                <YAxis fontSize={9} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="fires" stroke="var(--destructive)" strokeWidth={1.5} fill="url(#areaFires)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
        <div className='px-4 text-xs text-muted-foreground mt-2'>Showing anomalies detected over the last 7 days. Peak activity observed on Saturday.</div>
      </SidebarGroup>
    </div>
  )
}


