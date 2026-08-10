import { useState } from "react"
import { Satellite, Radar, Activity, Crosshair, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

import { mockFireData } from "@/mocks/fire-data"
import { useMapStore } from "@/store/use-map-store"
import { useLayerStore } from "@/store/use-layer-store"
import { useDataStore } from "@/store/use-data-store"
import { syncLayers } from "@/hooks/use-map-layers"

export function DetectionPage() {
  const [scanning, setScanning] = useState(false)
  const [scanStep, setScanStep] = useState("")
  const [scanCount, setScanCount] = useState(0)

  const activeFireCount = useDataStore((s) => s.activeFireCount)
  const setActiveFireCount = useDataStore((s) => s.setActiveFireCount)
  const { mapInstance, setFlyToTarget } = useMapStore()
  const { setShowFires } = useLayerStore()

  const handleDeepScan = () => {
    setScanning(true)
    setScanStep("Reading VIIRS telemetry...")

    setTimeout(() => {
      setScanStep("Calibrating thermal spectrum...")
    }, 700)

    setTimeout(() => {
      setScanStep("Analyzing anomaly matrix...")
    }, 1400)

    setTimeout(() => {
      const randomOffsetLat = (Math.random() - 0.5) * 1.5
      const randomOffsetLng = (Math.random() - 0.5) * 2.5
      const newLat = 42.5 + randomOffsetLat
      const newLng = 25.3 + randomOffsetLng

      const newAnomaly = {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [newLng, newLat] as [number, number],
        },
        properties: {
          intensity: Math.random() > 0.6 ? "critical" : "high",
          title: `Auto-Scan Detection #${mockFireData.features.length + 1}`,
          date: new Date().toISOString(),
        },
      }

      mockFireData.features.push(newAnomaly)

      if (mapInstance) {
        syncLayers(mapInstance, mockFireData)
      }

      const updatedCount = mockFireData.features.length
      setActiveFireCount(updatedCount)
      setScanCount(prev => prev + 1)

      setShowFires(true)

      setFlyToTarget({ lat: newLat, lng: newLng, zoom: 11 })

      toast.success("Thermal scan complete!", {
        description: `New active anomaly detected at ${newLat.toFixed(4)}° N, ${newLng.toFixed(4)}° E`,
      })

      setScanning(false)
      setScanStep("")
    }, 2200)
  }

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
          <div className='bg-background/20 backdrop-blur-xl rounded-xl p-3 space-y-2 relative overflow-hidden'>
            <div className='flex items-center justify-between'>
              <span className='text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1'>
                <Activity className='size-3' /> Latest Scan
              </span>
              <span className='text-[10px] text-muted-foreground'>
                {scanning ? "Scanning..." : "Just now"}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-medium'>Anomalies Total</span>
              <Badge variant='outline' className='h-5 px-1.5 text-[10px] border-destructive text-destructive bg-destructive/10 font-mono'>
                {activeFireCount} Total
              </Badge>
            </div>
            {scanCount > 0 && (
              <div className="text-[9px] text-emerald-500 font-semibold animate-bounce mt-1">
                +{scanCount} new hotspot{scanCount > 1 ? "s" : ""} active
              </div>
            )}
          </div>

          <Button
            onClick={handleDeepScan}
            disabled={scanning}
            className={`
              w-full text-xs h-9 bg-destructive hover:bg-destructive/90 text-primary-foreground font-semibold cursor-pointer
              transition-all duration-300
              ${scanning ? "opacity-90 pl-2 bg-destructive/80" : ""}
            `}
          >
            {scanning ? (
              <>
                <Loader2 className='size-3.5 animate-spin mr-1.5' />
                <span className="text-[10px] font-semibold tracking-wide animate-pulse">
                  {scanStep}
                </span>
              </>
            ) : (
              <>
                <Crosshair className='size-3.5' /> Run Deep Scan
              </>
            )}
          </Button>
        </div>
      </SidebarGroup>
    </>
  )
}
