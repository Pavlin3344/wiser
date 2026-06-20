import React from "react"
import { format, subMonths } from "date-fns"
import { Map, Flame, LineChart, Bell, CalendarIcon, AlertTriangle } from "lucide-react"
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

import { Sidebar, SidebarProvider, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarInset, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { MapContainer } from "@/components/map/map-container"
import { useMapStore } from "@/store/use-map-store"

const mockChartData = [
  { name: "Mon", fires: 4 },
  { name: "Tue", fires: 7 },
  { name: "Wed", fires: 2 },
  { name: "Thu", fires: 12 },
  { name: "Fri", fires: 9 },
  { name: "Sat", fires: 15 },
  { name: "Sun", fires: 8 },
]

function App() {
  const [isOpen, setIsOpen] = React.useState(true)

  const { activeSidebarTab, setActiveSidebarTab, mapView, setMapView, basemap, setBasemap, showFires, setShowFires, dateRange, setDateRange } = useMapStore()

  const minDate = subMonths(new Date(), 3)

  const renderSidebarContent = () => {
    switch (activeSidebarTab) {
      case "analysis":
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

      case "alerts":
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

      case "risk":
      default:
        return (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Data Filters</SidebarGroupLabel>
              <div className='px-4 py-2 space-y-4'>
                <div className='space-y-1.5'>
                  <Label className='text-xs text-muted-foreground'>Region</Label>
                  <Select defaultValue='all'>
                    <SelectTrigger className='h-8 text-xs'>
                      <SelectValue placeholder='Select region' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all' className='text-xs cursor-pointer focus:bg-destructive/15 focus:text-destructive'>
                        All Regions
                      </SelectItem>
                      <SelectItem value='north' className='text-xs cursor-pointer focus:bg-destructive/15 focus:text-destructive'>
                        Northern Sector
                      </SelectItem>
                      <SelectItem value='south' className='text-xs cursor-pointer focus:bg-destructive/15 focus:text-destructive'>
                        Southern Sector
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-1.5'>
                  <Label className='text-xs text-muted-foreground'>Risk Level</Label>
                  <Select defaultValue='all'>
                    <SelectTrigger className='h-8 text-xs'>
                      <SelectValue placeholder='Select severity' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all' className='text-xs cursor-pointer focus:bg-destructive/15 focus:text-destructive'>
                        All Risk Levels
                      </SelectItem>
                      <SelectItem value='high' className='text-xs cursor-pointer focus:bg-destructive/15 focus:text-destructive'>
                        High / Critical
                      </SelectItem>
                      <SelectItem value='moderate' className='text-xs cursor-pointer focus:bg-destructive/15 focus:text-destructive'>
                        Moderate
                      </SelectItem>
                      <SelectItem value='low' className='text-xs cursor-pointer focus:bg-destructive/15 focus:text-destructive'>
                        Low
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-3 pt-2'>
                  <Label className='text-xs text-muted-foreground'>Indicators</Label>
                  <div className='flex items-center space-x-2'>
                    <Checkbox id='chk-thermal' defaultChecked />
                    <Label htmlFor='chk-thermal' className='text-xs font-medium cursor-pointer'>
                      Thermal Anomalies
                    </Label>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <Checkbox id='chk-smoke' defaultChecked />
                    <Label htmlFor='chk-smoke' className='text-xs font-medium cursor-pointer'>
                      Smoke Plumes
                    </Label>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <Checkbox id='chk-wind' />
                    <Label htmlFor='chk-wind' className='text-xs font-medium cursor-pointer'>
                      Wind Vectors
                    </Label>
                  </div>

                  <div className='flex items-center space-x-2'>
                    <Checkbox id='chk-evac' />
                    <Label htmlFor='chk-evac' className='text-xs font-medium cursor-pointer'>
                      Evacuation Routes
                    </Label>
                  </div>
                </div>
              </div>
            </SidebarGroup>

            <SidebarGroup className='mt-4 border-t border-border/50 pt-4'>
              <SidebarGroupLabel>Timeline & Forecast</SidebarGroupLabel>
              <div className='px-4 py-2 space-y-3'>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant='outline' className='w-full justify-start text-left font-normal h-9 px-3 text-xs'>
                      <CalendarIcon className='mr-2 h-4 w-4 shrink-0' />
                      <span className='truncate'>{dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}` : format(dateRange.from, "MMM d, yyyy")) : "Pick a date"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0' align='start'>
                    <Calendar mode='range' selected={dateRange} onSelect={setDateRange} disabled={(d) => d > new Date() || d < minDate} />
                  </PopoverContent>
                </Popover>
                <div className='flex gap-2'>
                  <Button variant='outline' size='sm' className='w-full text-xs h-8'>
                    Today
                  </Button>
                </div>
              </div>
            </SidebarGroup>
          </>
        )
    }
  }

  return (
    <SidebarProvider open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Sidebar variant='sidebar' collapsible='offcanvas' className='bg-background/80 backdrop-blur-md shadow-sm rounded-2xl border-none'>
          <div className='p-2 flex items-center justify-end'>
            <SidebarTrigger />
          </div>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setActiveSidebarTab("risk")} isActive={activeSidebarTab === "risk"}>
                    <Map className={activeSidebarTab === "risk" ? "text-destructive" : ""} />
                    Risk Assessment
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setActiveSidebarTab("detection")} isActive={activeSidebarTab === "detection"}>
                    <Flame className={activeSidebarTab === "detection" ? "text-destructive" : ""} />
                    Detection
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setActiveSidebarTab("analysis")} isActive={activeSidebarTab === "analysis"}>
                    <LineChart className={activeSidebarTab === "analysis" ? "text-destructive" : ""} />
                    Analysis & Trends
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setActiveSidebarTab("alerts")} isActive={activeSidebarTab === "alerts"}>
                    <Bell className={activeSidebarTab === "alerts" ? "text-destructive" : ""} />
                    System Alerts
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            {renderSidebarContent()}
          </SidebarContent>
        </Sidebar>

        <SidebarInset className='relative p-0 overflow-hidden bg-muted/20'>
          <div className='absolute inset-0 z-0'>
            <MapContainer basemap={basemap} mapView={mapView} showFires={showFires} />
          </div>

          <div className='absolute top-2 left-2 z-10 flex items-center gap-2 pointer-events-none'>
            {!isOpen && (
              <div className='pointer-events-auto'>
                <SidebarTrigger className='bg-background/70 backdrop-blur-md border shadow-sm hover:bg-background h-10 w-10 rounded-xl' />
              </div>
            )}

            <div className='pointer-events-auto bg-background/70 backdrop-blur-md shadow-sm rounded-full flex items-center h-10 px-3 gap-2'>
              <div className='flex items-center gap-2'>
                <span className='relative flex h-2 w-2'>
                  <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75'></span>
                  <span className='relative inline-flex rounded-full h-2 w-2 bg-destructive'></span>
                </span>
                <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Active Fires</span>
                <Badge variant='destructive' className='h-5 px-1.5 text-xs font-bold'>
                  12
                </Badge>
              </div>
            </div>

            <div className='pointer-events-auto bg-background/70 backdrop-blur-md shadow-sm rounded-full flex items-center h-10 px-3 gap-2'>
              <div className='flex items-center gap-2'>
                <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Risk</span>
                <Badge variant='default' className='h-5 px-1.5 text-xs font-bold text-amber-500 bg-amber-500/10'>
                  Moderate
                </Badge>
              </div>
            </div>
          </div>

          <div className='absolute top-2 right-2 z-10 pointer-events-auto'>
            <div className='bg-background/70 backdrop-blur-md shadow-sm rounded-2xl p-3 flex flex-col gap-2 w-52'>
              <div>
                <Label className='text-[10px] uppercase tracking-wider text-muted-foreground px-1'>Camera View</Label>
                <Tabs value={mapView} onValueChange={(v) => setMapView(v as "2d" | "3d")} className='w-full'>
                  <TabsList className='grid w-full grid-cols-2 h-8'>
                    <TabsTrigger value='2d' className='text-xs data-[state=active]:text-destructive font-semibold'>
                      2D
                    </TabsTrigger>
                    <TabsTrigger value='3d' className='text-xs data-[state=active]:text-destructive font-semibold'>
                      3D Globe
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div>
                <Label className='text-[10px] uppercase tracking-wider text-muted-foreground px-1'>Base Map</Label>
                <Tabs value={basemap} onValueChange={(v) => setBasemap(v as "topographic" | "satellite")} className='w-full'>
                  <TabsList className='grid w-full grid-cols-2 h-8'>
                    <TabsTrigger value='topographic' className='text-xs data-[state=active]:text-destructive font-semibold'>
                      Terrain
                    </TabsTrigger>
                    <TabsTrigger value='satellite' className='text-xs data-[state=active]:text-destructive font-semibold'>
                      Satellite
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>

          <div className='absolute bottom-18 right-2 z-10 pointer-events-auto'>
            <div className='bg-background/70 backdrop-blur-md shadow-sm rounded-2xl p-3 flex flex-col gap-2 w-full'>
              <Label className='text-[10px] uppercase tracking-wider text-muted-foreground font-bold'>Map Legend</Label>
              <div className='flex flex-col gap-1.5'>
                <div className='flex items-center gap-2'>
                  <div className='size-3 rounded-full bg-destructive border border-white/20' />
                  <span className='text-[10px] font-medium'>Active Ignition</span>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='size-3 rounded-sm bg-orange-500/80 border border-white/20' />
                  <span className='text-[10px] font-medium'>High Risk Zone</span>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='size-3 rounded-sm bg-amber-400/80 border border-white/20' />
                  <span className='text-[10px] font-medium'>Moderate Risk</span>
                </div>
              </div>
            </div>
          </div>

          <div className='absolute bottom-2 right-2 z-10 pointer-events-auto flex flex-col items-end gap-2 w-56'>
            <div className='bg-background/70 backdrop-blur-md shadow-sm rounded-2xl p-3 flex items-center justify-between w-full'>
              <div className='flex flex-col gap-1'>
                <Label className='text-sm font-semibold flex items-center gap-1.5 cursor-pointer' onClick={() => setShowFires(!showFires)}>
                  <Flame className='size-4 text-destructive' /> Live Data
                </Label>
                <span className='text-[10px] text-muted-foreground leading-none'>Real-time heat anomalies</span>
              </div>
              <Switch checked={showFires} onCheckedChange={setShowFires} className='data-[state=checked]:bg-destructive' />
            </div>
          </div>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  )
}

export default App
