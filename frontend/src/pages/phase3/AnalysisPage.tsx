import { useState } from "react"
import { Bar, BarChart, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { TrendingUp, Flame } from "lucide-react"

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

export function AnalysisPage() {
  const [chartType, setChartType] = useState<"bar" | "area">("bar")

  const totalFires = mockChartData.reduce((acc, curr) => acc + curr.fires, 0)
  const maxFires = Math.max(...mockChartData.map(d => d.fires))

  return (
    <div>
      <SidebarGroup className="space-y-4">

        <SidebarGroupLabel>Weekly Fire Information</SidebarGroupLabel>
        <div className="grid grid-cols-2 grid-rows-2 gap-2 px-2 text-xs font-mono leading-5">
          <div className="bg-background/20 backdrop-blur-md rounded-2xl p-2 border border-white/10 border-t-white/20 border-l-white/20 flex flex-col justify-center">
            <span className="text-muted-foreground uppercase flex items-center justify-center">
              Total
            </span>
            <span className="text-foreground">
              {totalFires}
            </span>
            <span className="text-emerald-500 flex items-center justify-center gap-0.5">
              <TrendingUp className="size-3" />
              <span>
                +12%
              </span>
            </span>
          </div>

          <div className="bg-background/20 backdrop-blur-md rounded-2xl p-2 border border-white/10 border-t-white/20 border-l-white/20 flex flex-col justify-center">
            <span className="text-muted-foreground uppercase flex items-center justify-center">
              Peak
            </span>
            <span className="text-foreground">
              {maxFires}
            </span>
            <span className="text-muted-foreground">
              Incidents
            </span>
          </div>

          <div className="bg-background/20 backdrop-blur-md rounded-2xl p-2 border border-white/10 border-t-white/20 border-l-white/20 flex flex-col justify-center relative">
            <span className="text-muted-foreground uppercase flex items-center justify-center gap-1.5">
              <div className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
              </div>
              Critical
            </span>
            <span className="text-destructive">
              3
            </span>
            <span className="text-red-500">
              Active
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
          <ResponsiveContainer width='100%' height='100%'>
            {chartType === "bar" ? (
              <BarChart data={mockChartData}>
                <XAxis dataKey='name' fontSize={10} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
                <YAxis fontSize={10} tickLine={false} axisLine={false} width={20} stroke='var(--muted-foreground)' />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey='fires' fill='var(--destructive)' radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="areaFires" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey='name' fontSize={10} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
                <YAxis fontSize={10} tickLine={false} axisLine={false} width={20} stroke='var(--muted-foreground)' />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Area type="monotone" dataKey="fires" stroke="var(--destructive)" strokeWidth={1.5} fill="url(#areaFires)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
        <div className='px-4 text-xs text-muted-foreground'>Showing anomalies detected over the last 7 days. Peak activity observed on Saturday.</div>
      </SidebarGroup>
    </div>
  )
}


