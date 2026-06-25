import type { DateRange } from "react-day-picker"
import { subMonths } from "date-fns/subMonths"
import { format } from "date-fns/format"

import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { Calendar } from "@/components/ui/calendar"

import { useMapStore } from "@/store/use-map-store"

export function FiltersView() {
  const { dateRange, setDateRange, region, setRegion, showRiskGrid, setShowRiskGrid, riskLevel, setRiskLevel, showThermal, setShowThermal, showSmoke, setShowSmoke, showWind, setShowWind, showEvac, setShowEvac } = useMapStore()
  const minDate = subMonths(new Date(), 3)

  const uiDateObj = {
    from: dateRange.from ? new Date(dateRange.from) : undefined,
    to: dateRange.to ? new Date(dateRange.to) : undefined,
  }

  const handleSelect = (newRange: DateRange | undefined) => {
    setDateRange({
      from: newRange?.from?.toISOString(),
      to: newRange?.to?.toISOString(),
    })
  }

  const setToday = () => {
    const today = new Date().toISOString()
    setDateRange({ from: today, to: today })
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Data Filters</SidebarGroupLabel>
        <div className='px-4 py-2 space-y-4'>
          <div className='space-y-1.5'>
            <Label className='text-xs text-muted-foreground'>Fire Risk</Label>
            <div className='flex items-center space-x-2 border-b border-white/5 pb-3 mb-3'>
              <Checkbox id='chk-risk' checked={showRiskGrid} onCheckedChange={(c) => setShowRiskGrid(c as boolean)} />
              <Label htmlFor='chk-risk' className='text-xs cursor-pointer'>
                Risk Grid
              </Label>
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label className='text-xs text-muted-foreground'>Region</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className='h-8 text-xs'>
                <SelectValue placeholder='Select region' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all' className='text-xs cursor-pointer focus:bg-destructive/50 focus:text-destructive'>
                  All Regions
                </SelectItem>
                <SelectItem value='north' className='text-xs cursor-pointer focus:bg-destructive/50 focus:text-destructive'>
                  Northern Sector
                </SelectItem>
                <SelectItem value='south' className='text-xs cursor-pointer focus:bg-destructive/50 focus:text-destructive'>
                  Southern Sector
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label className='text-xs text-muted-foreground'>Risk Level</Label>
            <Select value={riskLevel} onValueChange={setRiskLevel}>
              <SelectTrigger className='h-8 text-xs'>
                <SelectValue placeholder='Select severity' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all' className='text-xs cursor-pointer focus:bg-destructive/50 focus:text-destructive'>
                  All Risk Levels
                </SelectItem>
                <SelectItem value='high' className='text-xs cursor-pointer focus:bg-destructive/50 focus:text-destructive'>
                  High / Critical
                </SelectItem>
                <SelectItem value='moderate' className='text-xs cursor-pointer focus:bg-destructive/50 focus:text-destructive'>
                  Moderate
                </SelectItem>
                <SelectItem value='low' className='text-xs cursor-pointer focus:bg-destructive/50 focus:text-destructive'>
                  Low
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-3 pt-2'>
            <Label className='text-xs text-muted-foreground'>Indicators</Label>
            <div className='flex items-center space-x-2'>
              <Checkbox id='chk-thermal' checked={showThermal} onCheckedChange={(c) => setShowThermal(c as boolean)} />
              <Label htmlFor='chk-thermal' className='text-xs font-medium cursor-pointer'>
                Thermal Anomalies
              </Label>
            </div>
            <div className='flex items-center space-x-2'>
              <Checkbox id='chk-smoke' checked={showSmoke} onCheckedChange={(c) => setShowSmoke(c as boolean)} />
              <Label htmlFor='chk-smoke' className='text-xs font-medium cursor-pointer'>
                Smoke Plumes
              </Label>
            </div>
            <div className='flex items-center space-x-2'>
              <Checkbox id='chk-wind' checked={showWind} onCheckedChange={(c) => setShowWind(c as boolean)} />
              <Label htmlFor='chk-wind' className='text-xs font-medium cursor-pointer'>
                Wind Vectors
              </Label>
            </div>

            <div className='flex items-center space-x-2'>
              <Checkbox id='chk-evac' checked={showEvac} onCheckedChange={(c) => setShowEvac(c as boolean)} />
              <Label htmlFor='chk-evac' className='text-xs font-medium cursor-pointer'>
                Evacuation Routes
              </Label>
            </div>
          </div>
        </div>
      </SidebarGroup>

      <SidebarGroup className='mt-4 border-t border-border/10 pt-4'>
        <SidebarGroupLabel>Timeline & Forecast</SidebarGroupLabel>
        <div className='px-4 py-2 space-y-3'>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' className='w-full justify-start text-left font-normal h-9 px-3 text-xs border border-border/10'>
                <CalendarIcon className='mr-2 h-4 w-4 shrink-0' />
                <span className='truncate'>{uiDateObj?.from ? (uiDateObj.to ? `${format(uiDateObj.from, "MMM d")} - ${format(uiDateObj.to, "MMM d, yyyy")}` : format(uiDateObj.from, "MMM d, yyyy")) : "Pick a date"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='start'>
              <Calendar mode='range' selected={uiDateObj} onSelect={handleSelect} disabled={(d) => d > new Date() || d < minDate} />
            </PopoverContent>
          </Popover>
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' onClick={setToday} className='w-full text-xs h-8 border border-border/10'>
              Today
            </Button>
          </div>
        </div>
      </SidebarGroup>
    </>
  )
}
