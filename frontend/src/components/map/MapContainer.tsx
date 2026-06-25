import { useEffect, useRef } from "react"
import maplibregl, { type StyleSpecification } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection, Point } from "geojson"

import { MapNavigation } from "@/components/map/MapNavigation"
import { generateDynamicRiskGrid } from "@/lib/grid-generator"
import { satelliteStyle, generateGlassPopupHTML, generateSectorPopupHTML } from "@/lib/map-config"
import { mockFireData } from "@/mocks/fire-data"
import { mockEvacuationRoutes } from "@/mocks/evacuation-data"
import { mockWindVectors } from "@/mocks/wind-data"
import { useMapStore } from "@/store/use-map-store"

const DEFAULT_STYLE = "https://demotiles.maplibre.org/style.json"

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const fireData = useRef<FeatureCollection>(mockFireData)

  const { basemap, mapView, showFires, showTerrain, showLabels, showEvac, showWind, riskLevel } = useMapStore()

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

    const riskData = generateDynamicRiskGrid(mapInstance.getBounds(), mapInstance.getZoom(), riskLevel)

    if (!mapInstance.getSource("risk-zones")) {
      mapInstance.addSource("risk-zones", { type: "geojson", data: riskData as any })
      mapInstance.addLayer({
        id: "risk-zones-fill",
        type: "fill",
        source: "risk-zones",
        paint: {
          "fill-color": ["match", ["get", "level"], "high", "#ef4444", "moderate", "#f59e0b", "low", "#22c55e", "#ffffff"],
          "fill-opacity": 0.2,
          "fill-outline-color": ["match", ["get", "level"], "high", "#ef4444", "moderate", "#f59e0b", "low", "#22c55e", "#ffffff"],
        },
      })
    } else {
      ;(mapInstance.getSource("risk-zones") as maplibregl.GeoJSONSource).setData(riskData as any)
    }

    if (!mapInstance.getSource("evac-routes")) {
      mapInstance.addSource("evac-routes", { type: "geojson", data: mockEvacuationRoutes as any })
      mapInstance.addLayer({
        id: "evac-routes-line",
        type: "line",
        source: "evac-routes",
        paint: {
          "line-color": "#3b82f6",
          "line-width": 3,
          "line-dasharray": [2, 2],
        },
      })
    }
    mapInstance.setLayoutProperty("evac-routes-line", "visibility", showEvac ? "visible" : "none")

    if (!mapInstance.getSource("wind-vectors")) {
      mapInstance.addSource("wind-vectors", { type: "geojson", data: mockWindVectors as any })
      mapInstance.addLayer({
        id: "wind-vectors-symbol",
        type: "symbol",
        source: "wind-vectors",
        layout: {
          "text-field": "↑",
          "text-rotate": ["get", "direction"],
          "text-size": 20,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#38bdf8",
          "text-halo-color": "#000000",
          "text-halo-width": 1,
        },
      })
    }
    mapInstance.setLayoutProperty("wind-vectors-symbol", "visibility", showWind ? "visible" : "none")

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

    const savedCamera = useMapStore.getState().camera

    map.current = new maplibregl.Map({
      container: mapContainer.current!,
      style: "DEFAULT_STYLE",
      center: [savedCamera.lng, savedCamera.lat],
      zoom: savedCamera.zoom,
      pitch: savedCamera.pitch,
      bearing: savedCamera.bearing,
      attributionControl: false,
      canvasContextAttributes: {
        antialias: true,
      },
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

      mapInstance.on("mouseenter", "risk-zones-fill", () => {
        mapInstance.getCanvas().style.cursor = "crosshair"
      })

      mapInstance.on("mouseleave", "risk-zones-fill", () => {
        mapInstance.getCanvas().style.cursor = ""
      })

      mapInstance.on("click", "risk-zones-fill", (e) => {
        if (!e.features || !e.features[0]) return

        const props = e.features[0].properties
        const level = props.level || "unknown"
        const sectorId = props.sectorId || "SEC-UNKNOWN"
        const temp = props.temp || "--"
        const humidity = props.humidity || "--"

        const dotColor = level === "high" ? "bg-destructive" : level === "moderate" ? "bg-orange-500" : "bg-emerald-500"
        const textColor = level === "high" ? "text-destructive" : level === "moderate" ? "text-orange-500" : "text-emerald-500"

        const html = generateSectorPopupHTML(sectorId, level, temp, humidity, dotColor, textColor)

        new maplibregl.Popup({
          closeButton: false,
          className: "glass-popup",
          offset: 0,
          maxWidth: "300px",
        })
          .setLngLat(e.lngLat)
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

    mapInstance.on("moveend", () => {
      useMapStore.getState().setCamera({
        lng: mapInstance.getCenter().lng,
        lat: mapInstance.getCenter().lat,
        zoom: mapInstance.getZoom(),
        pitch: mapInstance.getPitch(),
        bearing: mapInstance.getBearing(),
      })

      syncMapLayers(mapInstance)
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
  }, [showFires, showTerrain, showLabels, showWind, showEvac, riskLevel])

  return (
    <div className='absolute inset-0 z-0'>
      <div className='relative h-full w-full'>
        <div ref={mapContainer} className='h-full w-full' />
        <MapNavigation mapRef={map} />
      </div>
    </div>
  )
}
