import * as React from "react"
import { AlertTriangleIcon, BarChart3Icon, CalendarIcon, FireExtinguisher, FlameIcon, GlobeIcon, LayersIcon, MapIcon, MapPinIcon, MoonIcon, RouteIcon, SunIcon, WindIcon } from "lucide-react"

import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command"
import { useGeolocation } from "@/hooks/use-geolocation"
import { useUIStore } from "@/store/use-ui-store"
import { useLayerStore } from "@/store/use-layer-store"
import { useMapStore } from "@/store/use-map-store"
import { useFilterStore } from "@/store/use-filter-store"

interface PhotonFeature {
  type: string
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
  properties: {
    name?: string
    city?: string
    town?: string
    state?: string
    country?: string
    osm_id?: number
  }
}

const formatLocation = (feature: PhotonFeature) => {
  const { name, city, town, state, country } = feature.properties
  const parts: string[] = []
  if (name) parts.push(name)

  const cityOrTown = city || town
  if (cityOrTown && cityOrTown !== name) {
    parts.push(cityOrTown)
  }

  if (state && state !== name && state !== cityOrTown) {
    parts.push(state)
  }

  if (country) {
    parts.push(country)
  }

  return parts.join(", ")
}

export const CommandMenu = React.memo(function CommandMenu({ open, setOpen }: { open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
  const { theme, setTheme, setActiveSidebarTab } = useUIStore()
  const { mapView, setMapView, basemap, setBasemap, setFlyToTarget } = useMapStore()
  const { showFires, setShowFires, showRiskGrid, setShowRiskGrid, showWind, setShowWind, showEvac, setShowEvac, showFuel, setShowFuel, showSettlement, setShowSettlement } = useLayerStore()

  const { findMe } = useGeolocation()

  const [search, setSearch] = React.useState("")
  const [results, setResults] = React.useState<PhotonFeature[]>([])
  const [loading, setLoading] = React.useState(false)

  const triggerSearch = React.useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const response = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=3`
      )
      const data = await response.json()
      if (data && data.features) {
        setResults(data.features)
      }
    } catch (error) {
      console.error("Photon geocoding error:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!search.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      triggerSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, triggerSearch])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && search.trim()) {
      triggerSearch(search)
    }
  }

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
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        className='bg-background/60 backdrop-blur-xl border border-white/10 border-t-white/20 border-l-white/20 ring-0 shadow-lg rounded-2xl! overflow-hidden'
      >
        <Command className='bg-transparent overflow-hidden relative rounded-2xl'>
          <div className='absolute inset-0 rounded-2xl bg-linear-to-br from-white/5 to-transparent pointer-events-none z-10' />
          <CommandInput
            placeholder='Type a command or search map features...'
            value={search}
            onValueChange={setSearch}
            onKeyDown={handleKeyDown}
          />
          <CommandList className='relative z-0'>
            <CommandEmpty>No features found.</CommandEmpty>

            {loading && (
              <div className='py-2 px-4 text-xs text-muted-foreground animate-pulse'>
                Searching locations...
              </div>
            )}

            {results.length > 0 && (
              <>
                <CommandGroup heading='Locations (Photon)'>
                  {results.map((feature, idx) => {
                    const label = formatLocation(feature)
                    return (
                      <CommandItem
                        key={`${feature.properties.osm_id || idx}-${idx}`}
                        value={`${label} ${search} ${feature.properties.osm_id || idx}`.toLowerCase()}
                        onSelect={() => {
                          const [lng, lat] = feature.geometry.coordinates
                          runCommand(() => {
                            setFlyToTarget({ lat, lng, zoom: 12 })
                          })
                        }}
                      >
                        <MapPinIcon className='mr-2 h-4 w-4 text-rose-500' />
                        <span>{label}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
                <CommandSeparator className='bg-white/5' />
              </>
            )}

            <CommandGroup heading='Views & Dashboards'>
              <CommandItem onSelect={() => runCommand(() => setActiveSidebarTab("risk"))}>
                <MapIcon className='mr-2 h-4 w-4 text-emerald-400' />
                <span>Risk Dashboard</span>
                <CommandShortcut>R</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setActiveSidebarTab("detection"))}>
                <FireExtinguisher className='mr-2 h-4 w-4 text-orange-500' />
                <span>Detection</span>
                <CommandShortcut>D</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setActiveSidebarTab("analysis"))}>
                <BarChart3Icon className='mr-2 h-4 w-4 text-violet-400' />
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
                <LayersIcon className='mr-2 h-4 w-4 text-amber-400' />
                <span>{showRiskGrid ? "Hide" : "Show"} EFFIS Risk Grid</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setShowFuel(!showFuel))}>
                <LayersIcon className='mr-2 h-4 w-4 text-emerald-400' />
                <span>{showFuel ? "Hide" : "Show"} EFFIS Fuel Map</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setShowSettlement(!showSettlement))}>
                <LayersIcon className='mr-2 h-4 w-4 text-purple-400' />
                <span>{showSettlement ? "Hide" : "Show"} Human Settlement Area</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setShowFires(!showFires))}>
                <FlameIcon className='mr-2 h-4 w-4 text-red-500' />
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
                <GlobeIcon className='mr-2 h-4 w-4 text-cyan-400' />
                <span>Switch to {mapView === "3d" ? "2D Flat" : "3D Globe"}</span>
                <CommandShortcut>G</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setBasemap(basemap === "satellite" ? "topographic" : "satellite"))}>
                <MapIcon className='mr-2 h-4 w-4 text-teal-400' />
                <span>Switch to {basemap === "satellite" ? "Topographic" : "Satellite"} Basemap</span>
                <CommandShortcut>B</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setTheme(theme === "dark" ? "light" : "dark"))}>
                {theme === "dark" ? <SunIcon className='mr-2 h-4 w-4 text-yellow-400' /> : <MoonIcon className='mr-2 h-4 w-4 text-indigo-300' />}
                <span>Toggle {theme === "dark" ? "Light" : "Dark"} Mode</span>
                <CommandShortcut>T</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className='bg-white/5' />

            <CommandGroup heading='Location'>
              <CommandItem onSelect={() => runCommand(() => findMe())}>
                <MapPinIcon className='mr-2 h-4 w-4 text-rose-500' />
                <span>Locate My Position</span>
                <CommandShortcut>⌘L</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className='bg-white/5' />

            <CommandGroup heading='Timeline'>
              <CommandItem onSelect={() => runCommand(() => useFilterStore.getState().setSelectedDate(new Date().toISOString()))}>
                <CalendarIcon className='mr-2 h-4 w-4 text-teal-400' />
                <span>Jump to Today</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  )
})
