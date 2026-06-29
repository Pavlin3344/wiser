import * as React from "react"
import { AlertTriangleIcon, BarChart3Icon, CalendarIcon, FireExtinguisher, FlameIcon, GlobeIcon, LayersIcon, MapIcon, MapPinIcon, MoonIcon, RouteIcon, SunIcon, WindIcon } from "lucide-react"

import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command"
import { useGeolocation } from "@/hooks/use-geolocation"
import { useUIStore } from "@/store/use-ui-store"
import { useLayerStore } from "@/store/use-layer-store"
import { useMapStore } from "@/store/use-map-store"
import { useFilterStore } from "@/store/use-filter-store"

export function CommandMenu({ open, setOpen }: { open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
  const { theme, setTheme, setActiveSidebarTab } = useUIStore()
  const { mapView, setMapView, basemap, setBasemap } = useMapStore()
  const { showFires, setShowFires, showRiskGrid, setShowRiskGrid, showWind, setShowWind, showEvac, setShowEvac } = useLayerStore()

  const { findMe } = useGeolocation()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [setOpen])

  const runCommand = React.useCallback(
    (command: () => void) => {
      setOpen(false)
      command()
    },
    [setOpen],
  )

  return (
    <div className='flex flex-col gap-4'>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command className='bg-background/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden'>
          <CommandInput placeholder='Type a command or search map features...' />
          <CommandList>
            <CommandEmpty>No features found.</CommandEmpty>

            <CommandGroup heading='Views & Dashboards'>
              <CommandItem onSelect={() => runCommand(() => setActiveSidebarTab("risk"))}>
                <MapIcon className='mr-2 h-4 w-4' />
                <span>Risk Dashboard</span>
                <CommandShortcut>R</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setActiveSidebarTab("detection"))}>
                <FireExtinguisher className='mr-2 h-4 w-4' />
                <span>Detection</span>
                <CommandShortcut>D</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setActiveSidebarTab("analysis"))}>
                <BarChart3Icon className='mr-2 h-4 w-4' />
                <span>Analytics & Charts</span>
                <CommandShortcut>A</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setActiveSidebarTab("alerts"))}>
                <AlertTriangleIcon className='mr-2 h-4 w-4 text-destructive' />
                <span>Live Alerts</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className='bg-white/5' />

            <CommandGroup heading='Map Layers (Toggle)'>
              <CommandItem onSelect={() => runCommand(() => setShowRiskGrid(!showRiskGrid))}>
                <LayersIcon className='mr-2 h-4 w-4' />
                <span>{showRiskGrid ? "Hide" : "Show"} EFFIS Risk Grid</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setShowFires(!showFires))}>
                <FlameIcon className={`mr-2 h-4 w-4 ${showFires ? "text-destructive" : ""}`} />
                <span>{showFires ? "Hide" : "Show"} Active Fires (VIIRS)</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setShowWind(!showWind))}>
                <WindIcon className='mr-2 h-4 w-4 text-sky-400' />
                <span>{showWind ? "Hide" : "Show"} Wind Vectors</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setShowEvac(!showEvac))}>
                <RouteIcon className='mr-2 h-4 w-4 text-blue-500' />
                <span>{showEvac ? "Hide" : "Show"} Evacuation Routes</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className='bg-white/5' />

            <CommandGroup heading='Map Settings'>
              <CommandItem onSelect={() => runCommand(() => setMapView(mapView === "3d" ? "2d" : "3d"))}>
                <GlobeIcon className='mr-2 h-4 w-4' />
                <span>Switch to {mapView === "3d" ? "2D Flat" : "3D Globe"}</span>
                <CommandShortcut>G</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setBasemap(basemap === "satellite" ? "topographic" : "satellite"))}>
                <MapIcon className='mr-2 h-4 w-4' />
                <span>Switch to {basemap === "satellite" ? "Topographic" : "Satellite"} Basemap</span>
                <CommandShortcut>B</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setTheme(theme === "dark" ? "light" : "dark"))}>
                {theme === "dark" ? <SunIcon className='mr-2 h-4 w-4' /> : <MoonIcon className='mr-2 h-4 w-4' />}
                <span>Toggle {theme === "dark" ? "Light" : "Dark"} Mode</span>
                <CommandShortcut>T</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className='bg-white/5' />

            <CommandGroup heading='Location'>
              <CommandItem onSelect={() => runCommand(() => findMe())}>
                <MapPinIcon className='mr-2 h-4 w-4' />
                <span>Locate My Position</span>
                <CommandShortcut>⌘L</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className='bg-white/5' />

            <CommandGroup heading='Timeline'>
              <CommandItem onSelect={() => runCommand(() => useFilterStore.getState().setSelectedDate(new Date().toISOString()))}>
                <CalendarIcon className='mr-2 h-4 w-4' />
                <span>Jump to Today</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  )
}
