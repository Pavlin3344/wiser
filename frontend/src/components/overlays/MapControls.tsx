import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useMapStore } from "@/store/use-map-store"

export function MapControls() {
  const { mapView, setMapView, basemap, setBasemap } = useMapStore()

  return (
    <div className='absolute top-2 right-2 z-10 pointer-events-auto'>
      <div className='bg-background/70 backdrop-blur-md shadow-sm rounded-2xl p-3 flex flex-col gap-2 w-52'>
        <div>
          <Label className='text-[10px] uppercase tracking-wider text-muted-foreground px-1'>Camera View</Label>
          <Tabs value={mapView} onValueChange={(v) => setMapView(v as "2d" | "3d")} className='w-full'>
            <TabsList className='grid w-full grid-cols-2 h-8'>
              <TabsTrigger value='2d' className='text-xs data-[state=active]:text-destructive font-semibold'>
                Flat
              </TabsTrigger>
              <TabsTrigger value='3d' className='text-xs data-[state=active]:text-destructive font-semibold'>
                Globe
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
  )
}
