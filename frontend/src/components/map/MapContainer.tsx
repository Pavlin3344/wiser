import { useEffect, useRef } from "react"
import maplibregl, { type StyleSpecification } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection, Point } from "geojson"

import { Minus, Plus, Navigation } from "lucide-react"

import { satelliteStyle, generateGlassPopupHTML } from "@/lib/map-config"

const mockFireData: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.5, 42.0] },
      properties: { intensity: "high", title: "EFFIS Anomaly Alpha", date: new Date().toISOString() },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.2, 42.1] },
      properties: { intensity: "moderate", title: "EFFIS Anomaly Beta", date: new Date().toISOString() },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.8, 41.8] },
      properties: { intensity: "critical", title: "EFFIS Anomaly Gamma", date: new Date().toISOString() },
    },
  ],
}

interface MapContainerProps {
  basemap: "topographic" | "satellite"
  mapView: "2d" | "3d"
  showFires: boolean
  showTerrain: boolean
  showLabels: boolean
}

export function MapContainer({ basemap, mapView, showFires, showTerrain, showLabels }: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)

  const fireData = useRef<FeatureCollection>(mockFireData)

  const fetchLiveFireData = async (mapInstance: maplibregl.Map) => {
    try {
      const response = await fetch("/api/v1/fires/active")

      if (response.ok) {
        const data: FeatureCollection = await response.json()
        fireData.current = data

        const source = mapInstance.getSource("active-fires") as maplibregl.GeoJSONSource
        if (source) {
          source.setData(fireData.current)
        }
      } else {
        console.warn("Wiser Backend not reachable yet. Using fallback EFFIS mock data.")
      }
    } catch (error) {
      console.warn("Backend API pending. Using fallback EFFIS mock data.")
      console.warn("[Error]: " + error)
    }
  }

  const injectFireData = (mapInstance: maplibregl.Map) => {
    if (mapInstance.getSource("active-fires")) return

    mapInstance.addSource("active-fires", {
      type: "geojson",
      data: fireData.current,
    })

    mapInstance.addLayer({
      id: "fire-points",
      type: "circle",
      source: "active-fires",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 12],
        "circle-color": "#ef4444",
        "circle-opacity": 0.8,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
      layout: {
        visibility: showFires ? "visible" : "none",
      },
    })
  }

  const injectTerrainData = (mapInstance: maplibregl.Map) => {
    if (mapInstance.getSource("3d-terrain")) return

    mapInstance.addSource("3d-terrain", {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 14,
    })
  }

  useEffect(() => {
    if (map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current!,
      style: "https://demotiles.maplibre.org/style.json",
      center: [25.5, 42.0],
      zoom: 7,
      attributionControl: false,
    })

    map.current.on("load", () => {
      const mapInstance = map.current!
      injectFireData(mapInstance)

      injectTerrainData(mapInstance)

      fetchLiveFireData(mapInstance)

      mapInstance.on("mouseenter", "fire-points", () => {
        mapInstance.getCanvas().style.cursor = "pointer"
      })

      mapInstance.on("mouseleave", "fire-points", () => {
        mapInstance.getCanvas().style.cursor = ""
      })

      mapInstance.on("click", "fire-points", (e) => {
        if (!e.features || !e.features[0]) return

        const coordinates = (e.features[0].geometry as Point).coordinates.slice()
        const properties = e.features[0].properties

        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360
        }

        const intensity = properties?.intensity || "unknown"
        const title = properties?.title || "Unknown Fire"
        const date = properties?.date ? new Date(properties.date).toLocaleDateString() : "Live"

        const dotColor = intensity === "critical" ? "bg-destructive" : intensity === "high" ? "bg-orange-500" : "bg-amber-400"
        const textColor = intensity === "critical" ? "text-destructive" : intensity === "high" ? "text-orange-500" : "text-amber-500"

        const html = generateGlassPopupHTML(date, title, intensity, coordinates, dotColor, textColor)

        new maplibregl.Popup({
          closeButton: false,
          className: "glass-popup",
          offset: 10,
        })
          .setLngLat(coordinates as [number, number])
          .setHTML(html)
          .addTo(mapInstance)
      })

      const coordsEl = document.getElementById("ui-coords")
      const elevEl = document.getElementById("ui-elevation")
      const zoomEl = document.getElementById("ui-zoom")

      let isUpdating = false

      mapInstance.on("mousemove", (e) => {
        if (isUpdating) return
        isUpdating = true

        requestAnimationFrame(() => {
          if (coordsEl) {
            coordsEl.innerText = `${e.lngLat.lat.toFixed(4)}° N, ${e.lngLat.lng.toFixed(4)}° E`
          }

          if (elevEl) {
            const elevation = mapInstance.queryTerrainElevation(e.lngLat)
            elevEl.innerText = elevation ? `${Math.round(elevation)}m ASL` : "0m ASL"
          }

          isUpdating = false
        })
      })

      mapInstance.on("zoom", () => {
        if (zoomEl) {
          zoomEl.innerText = `ZOOM: ${mapInstance.getZoom().toFixed(1)}`
        }
      })

      if (zoomEl) zoomEl.innerText = `ZOOM: ${mapInstance.getZoom().toFixed(1)}`

      mapInstance.on("rotate", () => {
        const compassEl = document.getElementById("ui-compass-icon")
        if (compassEl) {
          compassEl.style.transform = `rotate(${-mapInstance.getBearing()}deg)`
        }
      })
    })

    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize()
    })

    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current)
    }

    return () => resizeObserver.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!map.current) return
    const mapInstance = map.current
    const targetStyle: string | StyleSpecification = basemap === "satellite" ? satelliteStyle : "https://demotiles.maplibre.org/style.json"

    mapInstance.setStyle(targetStyle)

    mapInstance.once("styledata", () => {
      injectFireData(mapInstance)
      injectTerrainData(mapInstance)

      if (showTerrain) {
        mapInstance.setTerrain({ source: "3d-terrain", exaggeration: 1.5 })
      } else {
        mapInstance.setTerrain(null)
      }

      mapInstance.setProjection({
        type: mapView === "3d" ? "globe" : "mercator",
      })

      if (mapInstance.getLayer("fire-points")) {
        mapInstance.setLayoutProperty("fire-points", "visibility", showFires ? "visible" : "none")
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap])

  useEffect(() => {
    if (!map.current) return
    const mapInstance = map.current

    const applyProjection = () => {
      mapInstance.stop()

      mapInstance.setProjection({
        type: mapView === "3d" ? "globe" : "mercator",
      })

      mapInstance.flyTo({
        pitch: 0,
        bearing: 0,
        zoom: mapView === "3d" ? 2 : 7,
        duration: 1500,
      })
    }

    if (mapInstance.isStyleLoaded()) {
      applyProjection()
    } else {
      mapInstance.once("style.load", applyProjection)
    }
  }, [mapView])

  useEffect(() => {
    if (!map.current) return
    const mapInstance = map.current

    const applyVisibility = () => {
      if (mapInstance.getLayer("fire-points")) {
        mapInstance.setLayoutProperty("fire-points", "visibility", showFires ? "visible" : "none")
      }
    }

    if (mapInstance.isStyleLoaded()) {
      applyVisibility()
    } else {
      mapInstance.once("style.load", applyVisibility)
    }
  }, [showFires])

  useEffect(() => {
    if (!map.current) return
    const mapInstance = map.current

    const applyTerrain = () => {
      if (showTerrain) {
        injectTerrainData(mapInstance)
        mapInstance.setTerrain({ source: "3d-terrain", exaggeration: 1.5 })
      } else {
        mapInstance.setTerrain(null)
      }
    }

    if (mapInstance.isStyleLoaded()) {
      applyTerrain()
    } else {
      mapInstance.once("style.load", applyTerrain)
    }
  }, [showTerrain])

  return (
    <div className='absolute inset-0 z-0'>
      <div className='relative h-full w-full'>
        <div ref={mapContainer} className='h-full w-full' />
        <div className='absolute right-2 bottom-12 z-10 flex flex-col gap-2'>
          <div className='relative flex flex-col shadow-lg rounded-full overflow-hidden border border-white/10 border-t-white/20 border-l-white/20 backdrop-blur-xl bg-background/60'>
            <div className='absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

            <button onClick={() => map.current?.zoomIn()} className='size-9 flex items-center justify-center bg-background/20 text-foreground hover:bg-muted/80 border-b border-white/10 transition-colors cursor-pointer z-10' title='Zoom In'>
              <Plus className='size-3' />
            </button>

            <button onClick={() => map.current?.zoomOut()} className='size-9 flex items-center justify-center bg-background/20 text-foreground hover:bg-muted/80 transition-colors cursor-pointer z-10' title='Zoom Out'>
              <Minus className='size-3' />
            </button>
          </div>

          <button onClick={() => map.current?.resetNorthPitch()} className='relative size-9 flex items-center justify-center bg-background/60 backdrop-blur-xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20 rounded-2xl text-foreground hover:bg-muted/80 transition-colors cursor-pointer' title='Reset North'>
            <div className='absolute inset-0 rounded-full bg-linear-to-br from-white/5 to-transparent pointer-events-none' />

            <div id='ui-compass-icon' className='transition-transform duration-75'>
              <Navigation className='size-3 text-primary fill-primary/20' />
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
