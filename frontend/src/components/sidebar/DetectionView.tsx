import { Satellite, Radar, Activity, Crosshair } from "lucide-react"

import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export function DetectionView() {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Sensor Network</SidebarGroupLabel>
        <div className='px-4 py-2 space-y-4'>
          <div className='flex items-center justify-between border-b border-border/10 pb-3'>
            <div className='flex flex-col gap-1'>
              <Label className='text-xs font-semibold flex items-center gap-1.5'>
                <Satellite className='size-3.5 text-destructive' /> VIIRS (Suomi NPP)
              </Label>
              <span className='text-[10px] text-muted-foreground'>High-res thermal anomalies</span>
            </div>
            <Switch defaultChecked className='data-[state=checked]:bg-destructive data-[state=checked]:border-destructive' />
          </div>

          <div className='flex items-center justify-between border-b border-border/10 pb-3'>
            <div className='flex flex-col gap-1'>
              <Label className='text-xs font-semibold flex items-center gap-1.5'>
                <Satellite className='size-3.5 text-destructive' /> MODIS (Aqua/Terra)
              </Label>
              <span className='text-[10px] text-muted-foreground'>Broad-swath fire detection</span>
            </div>
            <Switch defaultChecked className='data-[state=checked]:bg-destructive data-[state=checked]:border-destructive' />
          </div>

          <div className='flex items-center justify-between pb-1'>
            <div className='flex flex-col gap-1'>
              <Label className='text-xs font-semibold flex items-center gap-1.5'>
                <Radar className='size-3.5 text-destructive' /> Auto-Scan Network
              </Label>
              <span className='text-[10px] text-muted-foreground'>Refresh telemetry every 5m</span>
            </div>
            <Switch defaultChecked className='data-[state=checked]:bg-destructive data-[state=checked]:border-destructive' />
          </div>
        </div>
      </SidebarGroup>

      <SidebarGroup className='mt-2'>
        <SidebarGroupLabel>Detection Parameters</SidebarGroupLabel>
        <div className='px-4 py-2 space-y-4'>
          <div className='space-y-1.5'>
            <Label className='text-xs text-muted-foreground'>Minimum Confidence</Label>
            <Select defaultValue='high'>
              <SelectTrigger className='h-8 text-xs bg-background/20 backdrop-blur-sm rounded-full'>
                <SelectValue placeholder='Select confidence' />
              </SelectTrigger>
              <SelectContent className='bg-background/40 backdrop-blur-sm border border-white/10 border-t-white/20 border-l-white/20 shadow-lg rounded-2xl'>
                <SelectItem value='nominal' className='text-xs cursor-pointer focus:bg-destructive/80 focus:text-destructive transition-colors'>
                  Nominal (&gt; 50%)
                </SelectItem>
                <SelectItem value='high' className='text-xs cursor-pointer focus:bg-destructive/80 focus:text-destructive transition-colors'>
                  High (&gt; 80%)
                </SelectItem>
                <SelectItem value='critical' className='text-xs cursor-pointer focus:bg-destructive/80 focus:text-destructive transition-colors'>
                  Critical (100% Verified)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SidebarGroup>

      <SidebarGroup className='mt-4 border-t border-white/10 pt-4'>
        <SidebarGroupLabel>Live Telemetry</SidebarGroupLabel>
        <div className='px-4 py-2 space-y-3'>
          <div className='bg-background/20 backdrop-blur-xl rounded-xl p-3 space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1'>
                <Activity className='size-3' /> Latest Scan
              </span>
              <span className='text-[10px] text-muted-foreground'>Just now</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-medium'>Anomalies Found</span>
              <Badge variant='outline' className='h-5 px-1.5 text-[10px] border-destructive text-destructive bg-destructive/10'>
                +3 New
              </Badge>
            </div>
          </div>

          <Button className='w-full text-xs h-9 bg-destructive hover:bg-destructive/90 text-primary-foreground font-semibold'>
            <Crosshair className='size-3.5' /> Run Deep Scan
          </Button>
        </div>
      </SidebarGroup>
    </>
  )
}
