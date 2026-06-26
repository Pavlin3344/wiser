import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { mockChartData } from "@/mocks/chart-data"

export function AnalysisView() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Weekly Fire Analysis</SidebarGroupLabel>
      <div className='px-4 py-4 h-48 w-full'>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={mockChartData}>
            <XAxis dataKey='name' fontSize={10} tickLine={false} axisLine={false} />
            <YAxis fontSize={10} tickLine={false} axisLine={false} width={20} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.1)" }} />
            <Bar dataKey='fires' fill='#ef4444' radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className='px-4 text-xs text-muted-foreground mt-2'>Showing anomalies detected over the last 7 days. Peak activity observed on Saturday.</div>
    </SidebarGroup>
  )
}
