import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useMapStore } from "@/store/use-map-store"

export function MapControls() {
  const { mapView, setMapView, basemap, setBasemap } = useMapStore()

  return (
    <div className='pointer-events-auto w-52'>
      <div className='relative bg-background/60 backdrop-blur-xl shadow-lg rounded-2xl border border-white/10 border-t-white/20 border-l-white/20 p-3 flex flex-col gap-3'>
        <div className='absolute inset-0 rounded-2xl bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

        <div>
          <Label className='text-[10px] uppercase tracking-wider text-muted-foreground px-1'>Camera View</Label>
          <Tabs value={mapView} onValueChange={(v) => setMapView(v as "2d" | "3d")} className='w-full'>
            <TabsList className='grid w-full grid-cols-2 h-8 bg-background/20 backdrop-blur-sm'>
              <TabsTrigger value='2d' className='text-xs data-[state=active]:text-destructive! font-semibold cursor-pointer'>
                Flat
              </TabsTrigger>
              <TabsTrigger value='3d' className='text-xs data-[state=active]:text-destructive! font-semibold cursor-pointer'>
                Globe
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div>
          <Label className='text-[10px] uppercase tracking-wider text-muted-foreground px-1'>Base Map</Label>
          <Tabs value={basemap} onValueChange={(v) => setBasemap(v as "topographic" | "satellite")} className='w-full'>
            <TabsList className='grid w-full grid-cols-2 h-8 bg-background/20 backdrop-blur-sm'>
              <TabsTrigger value='topographic' className='text-xs data-[state=active]:text-destructive! font-semibold cursor-pointer'>
                Terrain
              </TabsTrigger>
              <TabsTrigger value='satellite' className='text-xs data-[state=active]:text-destructive! font-semibold cursor-pointer'>
                Satellite
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
