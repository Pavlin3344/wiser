import { useEffect, useRef } from "react"
import maplibregl, { type StyleSpecification } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection, Point } from "geojson"

import { MapNavigation } from "@/components/map/MapNavigation"

import { satelliteStyle, generateGlassPopupHTML } from "@/lib/map-config"

const DEFAULT_STYLE = "https://demotiles.maplibre.org/style.json"

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

  const syncMapLayers = (mapInstance: maplibregl.Map) => {
    if (!mapInstance.getSource("3d-terrain")) {
      mapInstance.addSource("3d-terrain", {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
      })
    }
    mapInstance.setTerrain(showTerrain ? { source: "3d-terrain", exaggeration: 1.5 } : null)

    if (!mapInstance.getSource("active-fires")) {
      mapInstance.addSource("active-fires", { type: "geojson", data: fireData.current })
    } else {
      ;(mapInstance.getSource("active-fires") as maplibregl.GeoJSONSource).setData(fireData.current)
    }

    if (!mapInstance.getLayer("fire-points")) {
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
      })
    }
    mapInstance.setLayoutProperty("fire-points", "visibility", showFires ? "visible" : "none")

    const labelVisibility = showLabels ? "visible" : "none"
    if (mapInstance.getLayer("country-borders")) {
      mapInstance.setLayoutProperty("country-borders", "visibility", labelVisibility)
      mapInstance.setLayoutProperty("place-labels", "visibility", labelVisibility)
    }
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

    const mapInstance = map.current

    map.current.on("load", () => {
      syncMapLayers(mapInstance)

      fetch("/api/v1/fires/active")
        .then((res) => (res.ok ? res.json() : Promise.reject("Wiser Backend not reachable yet. Using fallback EFFIS mock data.")))
        .then((data) => {
          fireData.current = data
          syncMapLayers(mapInstance)
        })
        .catch((err) => {
          console.warn("Backend API pending. Using fallback EFFIS mock data.")
          console.warn("[Error]: " + err)
        })

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

        new maplibregl.Popup({ closeButton: false, className: "glass-popup", offset: 10 })
          .setLngLat(coordinates as [number, number])
          .setHTML(html)
          .addTo(mapInstance)
      })

      let isUpdating = false

      mapInstance.on("mousemove", (e) => {
        if (isUpdating) return
        isUpdating = true

        requestAnimationFrame(() => {
          const coordsEl = document.getElementById("ui-coords")
          const elevEl = document.getElementById("ui-elevation")

          if (coordsEl) coordsEl.innerText = `${e.lngLat.lat.toFixed(4)}° N, ${e.lngLat.lng.toFixed(4)}° E`

          if (elevEl) {
            const elevation = mapInstance.queryTerrainElevation(e.lngLat)
            elevEl.innerText = elevation ? `${Math.round(elevation)}m ASL` : "0m ASL"
          }

          isUpdating = false
        })
      })

      mapInstance.on("zoom", () => {
        const zoomEl = document.getElementById("ui-zoom")
        if (zoomEl) zoomEl.innerText = `ZOOM: ${mapInstance.getZoom().toFixed(1)}`
      })

      mapInstance.on("rotate", () => {
        const compassEl = document.getElementById("ui-compass-icon")
        if (compassEl) compassEl.style.transform = `rotate(${-mapInstance.getBearing()}deg)`
      })
    })

    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize()
    })
    resizeObserver.observe(mapContainer.current!)
    return () => resizeObserver.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!map.current) return
    const mapInstance = map.current
    const targetStyle: string | StyleSpecification = basemap === "satellite" ? satelliteStyle : DEFAULT_STYLE

    mapInstance.setStyle(targetStyle)

    mapInstance.once("styledata", () => {
      syncMapLayers(mapInstance)
      mapInstance.setProjection({ type: mapView === "3d" ? "globe" : "mercator" })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap])

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return
    const mapInstance = map.current

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
  }, [mapView])

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return
    syncMapLayers(map.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFires, showTerrain, showLabels])

  return (
    <div className='absolute inset-0 z-0'>
      <div className='relative h-full w-full'>
        <div ref={mapContainer} className='h-full w-full' />
        <MapNavigation mapRef={map} />
      </div>
    </div>
  )
}
