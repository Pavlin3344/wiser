import { subMonths } from "date-fns/subMonths"
import { format } from "date-fns/format"

import { CalendarIcon } from "lucide-react"

import { TimeSlider } from "@/components/sidebar/TimeSlider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SidebarGroup } from "@/components/ui/sidebar"
import { Calendar } from "@/components/ui/calendar"

import { useFilterStore } from "@/store/use-filter-store"
import { useLayerStore } from "@/store/use-layer-store"

export function RiskAssessmentPage() {
  const { selectedDate, setSelectedDate, region, setRegion, riskLevel, setRiskLevel } = useFilterStore()
  const { showRiskGrid, setShowRiskGrid, showThermal, setShowThermal, showSmoke, setShowSmoke, showWind, setShowWind, showEvac, setShowEvac } = useLayerStore()
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
            <div className='flex items-center space-x-2'>
              <Checkbox id='chk-risk' checked={showRiskGrid} onCheckedChange={(c) => setShowRiskGrid(c as boolean)} className='data-[state=checked]:bg-destructive! data-[state=checked]:border-destructive' />
              <Label htmlFor='chk-risk' className='text-xs cursor-pointer'>
                Risk Grid
              </Label>
            </div>
          </div>
        </div>
      </SidebarGroup>

      <SidebarGroup>
        <div className='px-4 space-y-3'>
          <Label className='text-xs text-muted-foreground'>Region</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className='h-8 text-xs bg-background/20 backdrop-blur-sm rounded-full'>
              <SelectValue placeholder='Select region' />
            </SelectTrigger>
            <SelectContent className='bg-background/40 backdrop-blur-sm border border-white/10 border-t-white/20 border-l-white/20 shadow-lg rounded-2xl'>
              <SelectItem value='world' className='text-xs cursor-pointer focus:bg-destructive/80 focus:text-destructive transition-colors'>
                World
              </SelectItem>
              <SelectItem value='europe' disabled className='text-xs cursor-pointer focus:bg-destructive/80 focus:text-destructive transition-colors'>
                Europe
              </SelectItem>
              <SelectItem value='bulgaria' className='text-xs cursor-pointer focus:bg-destructive/80 focus:text-destructive transition-colors'>
                Bulgaria
              </SelectItem>
            </SelectContent>
          </Select>
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
