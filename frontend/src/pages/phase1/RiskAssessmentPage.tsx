import { subMonths } from "date-fns/subMonths"
import { format } from "date-fns/format"

import { CalendarIcon, MapPin } from "lucide-react"

import { TimeSlider } from "@/components/sidebar/TimeSlider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SidebarGroup } from "@/components/ui/sidebar"
import { Calendar } from "@/components/ui/calendar"

import { useDataStore } from "@/store/use-data-store"
import { useFilterStore } from "@/store/use-filter-store"
import { useLayerStore } from "@/store/use-layer-store"

export function RiskAssessmentPage() {
  const { selectedDate, setSelectedDate, riskLevel, setRiskLevel } = useFilterStore()
  const { showRiskGrid, setShowRiskGrid, showRiskZones, setShowRiskZones, showThermal, setShowThermal, showSmoke, setShowSmoke, showWind, setShowWind, showEvac, setShowEvac, showFuel, setShowFuel, showSettlement, setShowSettlement } = useLayerStore()
  const riskZoneCount = useDataStore((s) => s.riskZoneCount)
  const minDate = subMonths(new Date(), 3)

  const uiDate = selectedDate ? new Date(selectedDate) : undefined

  const handleSelect = (newDate: Date | undefined) => {
    if (!newDate) return
    setSelectedDate(newDate.toISOString())
  }

  const setToday = () => {
    setSelectedDate(new Date().toISOString())
  }

  return (
    <>
      <SidebarGroup>
        <div className='px-4 space-y-3'>
          <Label className='text-xs text-muted-foreground'>Fire Risk</Label>
          <div className='space-y-3'>
            {/* Two models on the same six-class scale, kept on separate toggles so they
                can be compared: Copernicus published vs. what this system computes. */}
            <div className='flex flex-col gap-1'>
              <div className='flex items-center space-x-2'>
                <Checkbox id='chk-risk' checked={showRiskGrid} onCheckedChange={(c) => setShowRiskGrid(c as boolean)} className='data-[state=checked]:bg-destructive! data-[state=checked]:border-destructive' />
                <Label htmlFor='chk-risk' className='text-xs cursor-pointer'>
                  EFFIS Fire Weather Index
                </Label>
              </div>
              <span className='pl-6 text-[10px] text-muted-foreground'>Copernicus raster, FWI only</span>
            </div>

            <div className='flex flex-col gap-1'>
              <div className='flex items-center space-x-2'>
                <Checkbox id='chk-risk-zones' checked={showRiskZones} onCheckedChange={(c) => setShowRiskZones(c as boolean)} className='data-[state=checked]:bg-destructive! data-[state=checked]:border-destructive' />
                <Label htmlFor='chk-risk-zones' className='text-xs cursor-pointer'>
                  Wiser Risk Zones
                </Label>
              </div>
              <span className='pl-6 text-[10px] text-muted-foreground'>
                {riskZoneCount > 0 ? `${riskZoneCount} cells · FWI + NDVI + fuel` : "FWI corrected by NDVI + fuel"}
              </span>
            </div>

            <div className='flex items-center space-x-2'>
              <Checkbox id='chk-fuel' checked={showFuel} onCheckedChange={(c) => setShowFuel(c as boolean)} className='data-[state=checked]:bg-destructive! data-[state=checked]:border-destructive' />
              <Label htmlFor='chk-fuel' className='text-xs cursor-pointer'>
                Fuel Map
              </Label>
            </div>
          </div>
        </div>
      </SidebarGroup>

      {/* Coverage is stated, not chosen. Every layer clips to the national border, so
          offering World or Europe would only download data nobody here monitors. */}
      <SidebarGroup>
        <div className='px-4 space-y-3'>
          <Label className='text-xs text-muted-foreground'>Coverage</Label>
          <div className='flex items-center gap-2 h-8 px-3 text-xs bg-background/20 backdrop-blur-sm rounded-full border border-white/10 border-t-white/20 border-l-white/20'>
            <MapPin className='size-3.5 shrink-0 text-destructive' />
            <span className='font-medium'>Bulgaria</span>
            <span className='ml-auto text-[10px] text-muted-foreground'>National</span>
          </div>
        </div>
      </SidebarGroup>

      <SidebarGroup>
        <div className='px-4 space-y-3'>
          <Label className='text-xs text-muted-foreground'>Risk Level</Label>
          <Select value={riskLevel} onValueChange={setRiskLevel}>
            <SelectTrigger className='h-8 text-xs bg-background/20 backdrop-blur-sm rounded-full'>
              <SelectValue placeholder='Select severity' />
            </SelectTrigger>
            <SelectContent className='bg-background/40 backdrop-blur-sm border border-white/10 border-t-white/20 border-l-white/20 shadow-lg rounded-2xl'>
              <SelectItem value='all' className='text-xs cursor-pointer focus:bg-destructive/80 focus:text-destructive transition-colors'>
                All Risk Levels
              </SelectItem>
              <SelectItem value='high' className='text-xs cursor-pointer focus:bg-destructive/80 focus:text-destructive transition-colors'>
                High / Critical
              </SelectItem>
              <SelectItem value='moderate' className='text-xs cursor-pointer focus:bg-orange-500/80 focus:text-destructive transition-colors'>
                Moderate
              </SelectItem>
              <SelectItem value='low' className='text-xs cursor-pointer focus:bg-emerald-500/80 focus:text-destructive transition-colors'>
                Low
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SidebarGroup>

      <SidebarGroup>
        <div className='px-4 space-y-3'>
          <Label className='text-xs text-muted-foreground'>Map Indicators</Label>
          <div className='flex items-center space-x-2'>
            <Checkbox id='chk-thermal' checked={showThermal} onCheckedChange={(c) => setShowThermal(c as boolean)} className='data-[state=checked]:bg-destructive! data-[state=checked]:border-destructive' />
            <Label htmlFor='chk-thermal' className='text-xs font-medium cursor-pointer'>
              Thermal Anomalies
            </Label>
          </div>
          <div className='flex items-center space-x-2'>
            <Checkbox id='chk-smoke' checked={showSmoke} onCheckedChange={(c) => setShowSmoke(c as boolean)} className='data-[state=checked]:bg-destructive! data-[state=checked]:border-destructive' />
            <Label htmlFor='chk-smoke' className='text-xs font-medium cursor-pointer'>
              Smoke Plumes
            </Label>
          </div>
          <div className='flex items-center space-x-2'>
            <Checkbox id='chk-wind' checked={showWind} onCheckedChange={(c) => setShowWind(c as boolean)} className='data-[state=checked]:bg-destructive! data-[state=checked]:border-destructive' />
            <Label htmlFor='chk-wind' className='text-xs font-medium cursor-pointer'>
              Wind Vectors
            </Label>
          </div>

          <div className='flex items-center space-x-2'>
            <Checkbox id='chk-evac' checked={showEvac} onCheckedChange={(c) => setShowEvac(c as boolean)} className='data-[state=checked]:bg-destructive! data-[state=checked]:border-destructive' />
            <Label htmlFor='chk-evac' className='text-xs font-medium cursor-pointer'>
              Evacuation Routes
            </Label>
          </div>

          <div className='flex items-center space-x-2'>
            <Checkbox id='chk-settlement' checked={showSettlement} onCheckedChange={(c) => setShowSettlement(c as boolean)} className='data-[state=checked]:bg-destructive! data-[state=checked]:border-destructive' />
            <Label htmlFor='chk-settlement' className='text-xs font-medium cursor-pointer'>
              Human Settlement
            </Label>
          </div>
        </div>
      </SidebarGroup>

      <SidebarGroup>
        <div className='px-4 py-2 space-y-3'>
          <Label className='text-xs text-muted-foreground'>Timeline & Forecast</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='ghost' className='w-full justify-start text-left font-normal h-9 px-3 text-xs bg-background/20 backdrop-blur-sm transition-colors'>
                <CalendarIcon className='mr-2 h-4 w-4 shrink-0 text-destructive' />
                <span className='truncate'>{uiDate ? format(uiDate, "MMM d, yyyy") : "Pick a date"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0 bg-background/40 backdrop-blur-sm border border-white/10 border-t-white/20 border-l-white/20 shadow-lg rounded-2xl ring-0 overflow-hidden transition-colors' align='start'>
              <Calendar mode='single' selected={uiDate} onSelect={handleSelect} disabled={(d) => d > new Date() || d < minDate} />
            </PopoverContent>
          </Popover>
          <div className='flex gap-2'>
            <Button variant='ghost' size='sm' onClick={setToday} className='w-full text-xs h-9 bg-background/20 backdrop-blur-sm transition-colors'>
              Today
            </Button>
          </div>
          <TimeSlider />
        </div>
      </SidebarGroup>
    </>
  )
}
