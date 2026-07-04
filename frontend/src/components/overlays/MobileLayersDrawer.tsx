import { useState } from "react"
import { Layers, Map, Globe, Mountain, Flame, Eye, X } from "lucide-react"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useMapStore } from "@/store/use-map-store"
import { useLayerStore } from "@/store/use-layer-store"
import { MapLegend } from "@/components/overlays/MapLegend"

export function MobileLayersDrawer() {
  const [isOpen, setIsOpen] = useState(false)

  const { mapView, setMapView, basemap, setBasemap } = useMapStore()
  const {
    showFires,
    setShowFires,
    showTerrain,
    setShowTerrain,
    showLabels,
    setShowLabels,
    showRiskGrid,
  } = useLayerStore()

  return (
    <>
      {/* Floating Google Maps-like Layers Button */}
      <button
        onClick={() => setIsOpen(true)}
        className='relative size-9 flex items-center justify-center bg-background/60 backdrop-blur-xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20 rounded-full text-foreground hover:bg-muted/80 transition-all duration-200 cursor-pointer pointer-events-auto'
        title='Map Layers'
      >
        <div className='absolute inset-0 rounded-full bg-linear-to-br from-white/5 to-transparent pointer-events-none' />
        <Layers className='size-4 text-destructive' />
      </button>

      {/* Bottom Sheet Drawer */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side='bottom'
          className='bg-background/80 backdrop-blur-xl border-t border-white/10 rounded-t-3xl pb-6 px-4 max-h-[85vh] overflow-y-auto w-full max-w-lg mx-auto outline-none [&>button]:hidden z-50'
        >
          {/* Drag Handle */}
          <div className='w-12 h-1 bg-white/20 rounded-full mx-auto my-3' />

          <SheetHeader className='px-2 flex flex-row items-center justify-between space-y-0 pb-4'>
            <SheetTitle className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>
              Map Details & Layers
            </SheetTitle>
            <button
              onClick={() => setIsOpen(false)}
              className='p-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors text-foreground'
            >
              <X className='size-3.5' />
            </button>
          </SheetHeader>

          <SheetDescription className='sr-only'>
            Configure map view type, projection style, active overlays, and view map legends.
          </SheetDescription>

          <div className='space-y-6 px-2 text-foreground'>
            {/* Map Type (Basemap) Section */}
            <div>
              <Label className='text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-2'>
                Map Type
              </Label>
              <div className='grid grid-cols-2 gap-3'>
                <button
                  onClick={() => setBasemap("topographic")}
                  className={`flex flex-col items-center justify-center py-3 px-4 rounded-xl border transition-all cursor-pointer ${
                    basemap === "topographic"
                      ? "bg-destructive/15 border-destructive text-destructive font-bold shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  <Mountain className='size-5 mb-1.5' />
                  <span className='text-xs'>Terrain</span>
                </button>
                <button
                  onClick={() => setBasemap("satellite")}
                  className={`flex flex-col items-center justify-center py-3 px-4 rounded-xl border transition-all cursor-pointer ${
                    basemap === "satellite"
                      ? "bg-destructive/15 border-destructive text-destructive font-bold shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  <Globe className='size-5 mb-1.5' />
                  <span className='text-xs'>Satellite</span>
                </button>
              </div>
            </div>

            {/* Camera View Section */}
            <div>
              <Label className='text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-2'>
                Camera View
              </Label>
              <div className='grid grid-cols-2 gap-3'>
                <button
                  onClick={() => setMapView("2d")}
                  className={`flex flex-col items-center justify-center py-3 px-4 rounded-xl border transition-all cursor-pointer ${
                    mapView === "2d"
                      ? "bg-destructive/15 border-destructive text-destructive font-bold shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  <Map className='size-5 mb-1.5' />
                  <span className='text-xs'>2D Flat</span>
                </button>
                <button
                  onClick={() => setMapView("3d")}
                  className={`flex flex-col items-center justify-center py-3 px-4 rounded-xl border transition-all cursor-pointer ${
                    mapView === "3d"
                      ? "bg-destructive/15 border-destructive text-destructive font-bold shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  <Globe className='size-5 mb-1.5' />
                  <span className='text-xs'>3D Globe</span>
                </button>
              </div>
            </div>

            {/* Map Details Toggles Section */}
            <div className='border-t border-white/10 pt-4 space-y-3.5'>
              <Label className='text-[10px] uppercase tracking-wider text-muted-foreground font-bold block'>
                Map Details
              </Label>

              {/* Live Data Toggle */}
              <div className='flex items-center justify-between py-1'>
                <div className='flex flex-col gap-0.5'>
                  <span className='text-xs font-semibold flex items-center gap-1.5'>
                    <Flame className='size-4 text-destructive' /> Live Data
                  </span>
                  <span className='text-[11px] text-muted-foreground'>Real-time heat anomalies</span>
                </div>
                <Switch
                  checked={showFires}
                  onCheckedChange={setShowFires}
                  className='data-[state=checked]:bg-destructive data-[state=checked]:border-destructive'
                />
              </div>

              {/* Map Overlays Toggle - Satellite Only */}
              {basemap === "satellite" && (
                <div className='flex items-center justify-between py-1 transition-all duration-200'>
                  <div className='flex flex-col gap-0.5'>
                    <span className='text-xs font-semibold flex items-center gap-1.5'>
                      <Eye className='size-4 text-destructive' /> Map Overlays
                    </span>
                    <span className='text-[11px] text-muted-foreground'>Borders & Labels</span>
                  </div>
                  <Switch
                    checked={showLabels}
                    onCheckedChange={setShowLabels}
                    className='data-[state=checked]:bg-destructive data-[state=checked]:border-destructive'
                  />
                </div>
              )}

              {/* 3D Terrain Toggle - Satellite Only */}
              {basemap === "satellite" && (
                <div className='flex items-center justify-between py-1 transition-all duration-200'>
                  <div className='flex flex-col gap-0.5'>
                    <span className='text-xs font-semibold flex items-center gap-1.5'>
                      <Mountain className='size-4 text-destructive' /> 3D Terrain
                    </span>
                    <span className='text-[11px] text-muted-foreground'>Topographic elevation view</span>
                  </div>
                  <Switch
                    checked={showTerrain}
                    onCheckedChange={setShowTerrain}
                    className='data-[state=checked]:bg-destructive data-[state=checked]:border-destructive'
                  />
                </div>
              )}
            </div>

            {/* Active Legends Section */}
            {(showRiskGrid || showFires) && (
              <div className='border-t border-white/10 pt-4 space-y-3'>
                <Label className='text-[10px] uppercase tracking-wider text-muted-foreground font-bold block'>
                  Active Legends
                </Label>
                <div className='flex flex-col sm:flex-row gap-3 items-start justify-start w-full overflow-x-auto pb-2'>
                  {showRiskGrid && (
                    <div className='w-full sm:w-auto shrink-0'>
                      <MapLegend title='Fire Weather Index' type='fwi' />
                    </div>
                  )}
                  {showFires && (
                    <div className='w-full sm:w-auto shrink-0'>
                      <MapLegend title='Active Fires (VIIRS)' type='viirs' />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
