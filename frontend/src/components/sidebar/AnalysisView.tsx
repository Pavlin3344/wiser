import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

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
        <p className='text-sm font-bold text-destructive'>
          {payload[0].value} <span className='text-xs font-medium text-foreground'>Fire Incidents</span>
        </p>
      </div>
    )
  }
  return null
}

export function AnalysisView() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Weekly Fire Analysis</SidebarGroupLabel>
      <div className='px-4 py-4 h-48 w-full'>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={mockChartData}>
            <XAxis dataKey='name' fontSize={10} tickLine={false} axisLine={false} stroke='var(--muted-foreground)' />
            <YAxis fontSize={10} tickLine={false} axisLine={false} width={20} stroke='var(--muted-foreground)' />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey='fires' fill='var(--destructive)' radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className='px-4 text-xs text-muted-foreground mt-2'>Showing anomalies detected over the last 7 days. Peak activity observed on Saturday.</div>
    </SidebarGroup>
  )
}
