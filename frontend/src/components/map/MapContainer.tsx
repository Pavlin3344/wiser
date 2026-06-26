import { useEffect, useRef } from "react"
import maplibregl, { type StyleSpecification } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection } from "geojson"

import { MapNavigation } from "@/components/map/MapNavigation"

import { satelliteStyle, generateGlassPopupHTML, generateSectorPopupHTML } from "@/lib/map-config"
import { generateDynamicWindVectors } from "@/lib/wind-generator"
import { mockFireData } from "@/mocks/fire-data"
import { mockEvacuationRoutes } from "@/mocks/evacuation-data"
import { useMapStore } from "@/store/use-map-store"

const LIGHT_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const fireData = useRef<FeatureCollection>(mockFireData)

  const windPhase = useRef(0)
  const reqAnimFrame = useRef<number | null>(null)
  const lastFrameTime = useRef<number>(0)

  const { basemap, mapView, showFires, showTerrain, showLabels, showEvac, showWind, riskLevel, showRiskGrid, isPlaying, theme } = useMapStore()

  const initializeLayers = (mapInstance: maplibregl.Map) => {
    const today = new Date().toISOString().split("T")[0]

    if (!mapInstance.getSource("3d-terrain")) {
      mapInstance.addSource("3d-terrain", {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
      })
    }

    if (!mapInstance.getSource("effis-fwi")) {
      mapInstance.addSource("effis-fwi", {
        type: "raster",
        tiles: [`/effis-wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=mf010.fwi&TIME=${today}&STYLES=&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=TRUE`],
        tileSize: 256,
        attribution: "Copernicus EFFIS",
      })
    }

    if (!mapInstance.getLayer("effis-fwi-layer")) {
      mapInstance.addLayer({
        id: "effis-fwi-layer",
        type: "raster",
        source: "effis-fwi",
        paint: { "raster-opacity": 0.7 },
      })
    }

    if (!mapInstance.getSource("effis-viirs")) {
      mapInstance.addSource("effis-viirs", {
        type: "raster",
        tiles: ["https://maps.effis.emergency.copernicus.eu/effis?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=viirs.hs&STYLES=&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=TRUE"],
        tileSize: 256,
        attribution: "Copernicus EFFIS",
      })
    }

    if (!mapInstance.getLayer("effis-viirs-layer")) {
      mapInstance.addLayer({
        id: "effis-viirs-layer",
        type: "raster",
        source: "effis-viirs",
        paint: { "raster-opacity": 0.8 },
        layout: { visibility: "none" },
      })
    }

    if (!mapInstance.getSource("evac-routes")) {
      mapInstance.addSource("evac-routes", { type: "geojson", data: mockEvacuationRoutes as FeatureCollection })
    }

    if (!mapInstance.getLayer("evac-routes-line")) {
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

    if (!mapInstance.getSource("active-fires")) {
      mapInstance.addSource("active-fires", { type: "geojson", data: fireData.current })
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
  }

  const syncMapLayers = (mapInstance: maplibregl.Map) => {
    const state = useMapStore.getState()

    mapInstance.setTerrain(state.showTerrain ? { source: "3d-terrain", exaggeration: 1.5 } : null)

    if (mapInstance.getLayer("effis-fwi-layer")) {
      mapInstance.setLayoutProperty("effis-fwi-layer", "visibility", state.showRiskGrid ? "visible" : "none")
    }

    if (mapInstance.getLayer("effis-viirs-layer")) {
      mapInstance.setLayoutProperty("effis-viirs-layer", "visibility", state.showFires ? "visible" : "none")
    }

    if (mapInstance.getLayer("evac-routes-line")) {
      mapInstance.setLayoutProperty("evac-routes-line", "visibility", state.showEvac ? "visible" : "none")
    }

    if (mapInstance.getSource("active-fires")) {
      ;(mapInstance.getSource("active-fires") as maplibregl.GeoJSONSource).setData(fireData.current)
    }

    if (mapInstance.getLayer("fire-points")) {
      mapInstance.setLayoutProperty("fire-points", "visibility", state.showFires ? "visible" : "none")
    }

    if (mapInstance.getLayer("wind-vectors-symbol")) {
      mapInstance.setLayoutProperty("wind-vectors-symbol", "visibility", state.showWind ? "visible" : "none")
    }

    const labelVisibility = state.showLabels ? "visible" : "none"

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
      style: LIGHT_STYLE,
      center: [savedCamera.lng, savedCamera.lat],
      zoom: savedCamera.zoom,
      pitch: savedCamera.pitch,
      bearing: savedCamera.bearing,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    })

    const mapInstance = map.current

    map.current.on("load", () => {
      initializeLayers(mapInstance)
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

      mapInstance.on("click", async (e) => {
        const state = useMapStore.getState()
        if (!state.showFires && !state.showRiskGrid) return

        const { lng, lat } = e.lngLat
        const canvas = mapInstance.getCanvas()
        const bounds = mapInstance.getBounds()
        const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`

        const layerToQuery = state.showFires ? "viirs.hs" : "mf010.fwi"
        const getFeatureInfoUrl = `/effis-wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${layerToQuery}&QUERY_LAYERS=${layerToQuery}&BBOX=${bbox}&WIDTH=${canvas.width}&HEIGHT=${canvas.height}&SRS=EPSG:3857&X=${Math.round(e.point.x)}&Y=${Math.round(e.point.y)}&INFO_FORMAT=application/json`

        try {
          const response = await fetch(getFeatureInfoUrl)
          const data = await response.json()

          if (data && data.features && data.features.length > 0) {
            const props = data.features[0].properties

            if (layerToQuery === "viirs.hs") {
              const date = props.FIREDATE ? new Date(props.FIREDATE).toLocaleDateString() : "Live"
              const intensity = props.FRP > 50 ? "critical" : props.FRP > 20 ? "high" : "moderate"
              const dotColor = intensity === "critical" ? "bg-destructive" : intensity === "high" ? "bg-orange-500" : "bg-amber-400"
              const textColor = intensity === "critical" ? "text-destructive" : intensity === "high" ? "text-orange-500" : "text-amber-500"

              const html = generateGlassPopupHTML(date, "VIIRS Sat Active Ignition", `FRP: ${props.FRP || "--"} MW`, [lng, lat], dotColor, textColor)
              new maplibregl.Popup({ closeButton: false, className: "glass-popup", offset: 10, maxWidth: "300px" }).setLngLat([lng, lat]).setHTML(html).addTo(mapInstance)
            } else if (layerToQuery === "mf010.fwi") {
              const riskVal = props.GRAY_INDEX || props.value || "Analyzing"
              const html = generateSectorPopupHTML(`Copernicus Macro Matrix`, `FWI Rating: ${riskVal}`, 0, 0, "bg-orange-500", "text-orange-500")
              new maplibregl.Popup({ closeButton: false, className: "glass-popup", offset: 10, maxWidth: "300px" }).setLngLat([lng, lat]).setHTML(html).addTo(mapInstance)
            }
          }
        } catch (err) {
          console.warn("Empty grid location metadata requested or server processing timeout.", err)
        }
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
  }, [])

  useEffect(() => {
    if (!map.current) return
    const mapInstance = map.current

    let targetStyle: string | StyleSpecification = theme === "dark" ? DARK_STYLE : LIGHT_STYLE
    if (basemap === "satellite") targetStyle = satelliteStyle

    mapInstance.setStyle(targetStyle)

    mapInstance.once("styledata", () => {
      initializeLayers(mapInstance)
      syncMapLayers(mapInstance)
      mapInstance.setProjection({ type: mapView === "3d" ? "globe" : "mercator" })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, theme])

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
  }, [showFires, showTerrain, showLabels, showWind, showEvac, riskLevel, showRiskGrid])

  useEffect(() => {
    if (!isPlaying || !map.current) return

    const interval = setInterval(() => {
      const store = useMapStore.getState()
      const nextTime = (store.currentTime + 1) % 24
      store.setCurrentTime(nextTime)
      syncMapLayers(map.current!)
    }, 500)

    return () => clearInterval(interval)
  }, [isPlaying])

  useEffect(() => {
    if (!map.current || !showWind) return

    const animateWind = (timestamp: number) => {
      reqAnimFrame.current = requestAnimationFrame(animateWind)
      if (timestamp - lastFrameTime.current < 41) return
      lastFrameTime.current = timestamp

      windPhase.current += 1
      const state = useMapStore.getState()
      const windData = generateDynamicWindVectors(map.current!.getBounds(), map.current!.getZoom(), state.currentTime, windPhase.current)

      if (!map.current!.getSource("wind-vectors")) {
        map.current!.addSource("wind-vectors", { type: "geojson", data: windData as FeatureCollection })
        map.current!.addLayer({
          id: "wind-vectors-symbol",
          type: "symbol",
          source: "wind-vectors",
          layout: {
            "text-field": "↑",
            "text-rotate": ["get", "direction"],
            "text-size": ["interpolate", ["linear"], ["get", "speed"], 5, 12, 40, 24],
            "text-allow-overlap": false,
            "text-ignore-placement": false,
            visibility: "visible",
          },
          paint: {
            "text-color": "#38bdf8",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1,
            "text-opacity": ["get", "opacity"],
          },
        })
      } else {
        const source = map.current?.getSource("wind-vectors") as maplibregl.GeoJSONSource | undefined
        if (source) source.setData(windData as FeatureCollection)
      }
    }

    reqAnimFrame.current = requestAnimationFrame(animateWind)

    return () => {
      if (reqAnimFrame.current) cancelAnimationFrame(reqAnimFrame.current)
    }
  }, [showWind])
  return (
    <div className='absolute inset-0 z-0'>
      <div className='relative h-full w-full'>
        <div ref={mapContainer} className='h-full w-full' />
        <MapNavigation mapRef={map} />
      </div>
    </div>
  )
}
