import { useState } from "react"
import { Satellite, Radar, Activity, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

import { fetchActiveFires } from "@/services/fireService"
import { useMapStore } from "@/store/use-map-store"
import { useLayerStore } from "@/store/use-layer-store"
import { useDataStore } from "@/store/use-data-store"
import { useFilterStore, SENSOR_MODIS, SENSOR_VIIRS } from "@/store/use-filter-store"
import { syncLayers } from "@/hooks/use-map-layers"

/** Confidence thresholds, matched against the value FIRMS reports per detection. */
const CONFIDENCE_OPTIONS = [
  { value: "0", label: "Any confidence" },
  { value: "50", label: "Nominal (> 50%)" },
  { value: "80", label: "High (> 80%)" },
]

export function DetectionPage() {
  const [refreshing, setRefreshing] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)

  const activeFireCount = useDataStore((s) => s.activeFireCount)
  const setActiveFireCount = useDataStore((s) => s.setActiveFireCount)
  const { mapInstance } = useMapStore()
  const { setShowFires } = useLayerStore()

  const minConfidence = useFilterStore((s) => s.minConfidence)
  const setMinConfidence = useFilterStore((s) => s.setMinConfidence)
  const enabledSensors = useFilterStore((s) => s.enabledSensors)
  const toggleSensor = useFilterStore((s) => s.toggleSensor)
  const liveUpdates = useFilterStore((s) => s.liveUpdates)
  const setLiveUpdates = useFilterStore((s) => s.setLiveUpdates)

  /** Pulls the current detections from the backend. It reports what is there - it never invents one. */
  const handleRefresh = () => {
    setRefreshing(true)

    fetchActiveFires()
      .then((data) => {
        const visible = data.features.filter((feature) => {
          const props = feature.properties ?? {}
          const confidence = typeof props.confidence === "number" ? props.confidence : 0
          const source = typeof props.source === "string" ? props.source : null
          return confidence >= minConfidence && (source === null || enabledSensors.includes(source))
        })

        if (mapInstance) {
          syncLayers(mapInstance, { ...data, features: visible })
        }
        setActiveFireCount(visible.length)
        setShowFires(true)
        setLastScan(new Date().toLocaleTimeString())

        toast.success("Detections refreshed", {
          description: visible.length === 0
            ? "No active detections match the current filters."
            : `${visible.length} active detection${visible.length > 1 ? "s" : ""} loaded.`,
        })
      })
      .catch((err) => {
        console.warn(`[Wiser] Refresh failed (${err}).`)
        toast.error("Could not reach the detection feed", {
          description: "The map still shows the last successful load.",
        })
      })
      .finally(() => setRefreshing(false))
  }

  const sensorRow = (source: string, title: string, subtitle: string, icon: React.ReactNode, last = false) => (
    <div className={`flex items-center justify-between ${last ? "pb-1" : "border-b border-border/10 pb-3"}`}>
      <div className='flex flex-col gap-1'>
        <Label className='text-xs font-semibold flex items-center gap-1.5'>
          {icon} {title}
        </Label>
        <span className='text-[10px] text-muted-foreground'>{subtitle}</span>
      </div>
      <Switch
        checked={enabledSensors.includes(source)}
        onCheckedChange={(on) => toggleSensor(source, on)}
        className='data-[state=checked]:bg-destructive data-[state=checked]:border-destructive'
      />
    </div>
  )

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Sensor Network</SidebarGroupLabel>
        <div className='px-4 py-2 space-y-4'>
          {sensorRow(
            SENSOR_VIIRS,
            "VIIRS (Suomi NPP)",
            "High-res thermal anomalies",
            <Satellite className='size-3.5 text-destructive' />,
          )}
          {sensorRow(
            SENSOR_MODIS,
            "MODIS (Aqua/Terra)",
            "Broad-swath fire detection",
            <Satellite className='size-3.5 text-destructive' />,
          )}

          <div className='flex items-center justify-between pb-1'>
            <div className='flex flex-col gap-1'>
              <Label className='text-xs font-semibold flex items-center gap-1.5'>
                <Radar className='size-3.5 text-destructive' /> Live Updates
              </Label>
              <span className='text-[10px] text-muted-foreground'>Push new detections as they arrive</span>
            </div>
            <Switch
              checked={liveUpdates}
              onCheckedChange={setLiveUpdates}
              className='data-[state=checked]:bg-destructive data-[state=checked]:border-destructive'
            />
          </div>
        </div>
      </SidebarGroup>

      <SidebarGroup className='mt-2'>
        <SidebarGroupLabel>Detection Parameters</SidebarGroupLabel>
        <div className='px-4 py-2 space-y-4'>
          <div className='space-y-1.5'>
            <Label className='text-xs text-muted-foreground'>Minimum Confidence</Label>
            <Select value={String(minConfidence)} onValueChange={(v) => setMinConfidence(Number(v))}>
              <SelectTrigger className='h-8 text-xs bg-background/20 backdrop-blur-sm rounded-full'>
                <SelectValue placeholder='Select confidence' />
              </SelectTrigger>
              <SelectContent className='bg-background/40 backdrop-blur-sm border border-white/10 border-t-white/20 border-l-white/20 shadow-lg rounded-2xl'>
                {CONFIDENCE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className='text-xs cursor-pointer focus:bg-destructive/80 focus:text-destructive transition-colors'
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SidebarGroup>

      <SidebarGroup className='mt-4 border-t border-white/10 pt-4'>
        <SidebarGroupLabel>Live Telemetry</SidebarGroupLabel>
        <div className='px-4 py-2 space-y-3'>
          <div className='bg-background/20 backdrop-blur-xl rounded-xl p-3 space-y-2 relative overflow-hidden'>
            <div className='flex items-center justify-between'>
              <span className='text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1'>
                <Activity className='size-3' /> Last Refresh
              </span>
              <span className='text-[10px] text-muted-foreground'>
                {refreshing ? "Loading..." : lastScan ?? "Not yet"}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-medium'>Detections Shown</span>
              <Badge variant='outline' className='h-5 px-1.5 text-[10px] border-destructive text-destructive bg-destructive/10 font-mono'>
                {activeFireCount} Total
              </Badge>
            </div>
          </div>

          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className='w-full text-xs h-9 bg-destructive hover:bg-destructive/90 text-primary-foreground font-semibold cursor-pointer transition-all duration-300'
          >
            {refreshing ? (
              <>
                <Loader2 className='size-3.5 animate-spin mr-1.5' />
                <span className='text-[10px] font-semibold tracking-wide'>Loading detections...</span>
              </>
            ) : (
              <>
                <RefreshCw className='size-3.5' /> Refresh Detections
              </>
            )}
          </Button>
        </div>
      </SidebarGroup>
    </>
  )
}
