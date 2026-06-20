import { AlertTriangle, Flame } from "lucide-react"

import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"

export function AlertsView() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Recent System Alerts</SidebarGroupLabel>
      <div className='px-4 py-2 flex flex-col gap-3'>
        <div className='flex gap-3 items-start border-b pb-3 border-border/50'>
          <div className='p-2 bg-destructive/10 rounded-full text-destructive mt-0.5'>
            <AlertTriangle className='size-4' />
          </div>
          <div>
            <p className='text-xs font-bold'>Critical Thermal Anomaly</p>
            <p className='text-[10px] text-muted-foreground'>Northern Sector • 10 mins ago</p>
          </div>
        </div>
        <div className='flex gap-3 items-start border-b pb-3 border-border/50'>
          <div className='p-2 bg-amber-500/10 rounded-full text-amber-500 mt-0.5'>
            <Flame className='size-4' />
          </div>
          <div>
            <p className='text-xs font-bold'>New Ignition Detected</p>
            <p className='text-[10px] text-muted-foreground'>Valley Ridge • 1 hr ago</p>
          </div>
        </div>
      </div>
    </SidebarGroup>
  )
}
