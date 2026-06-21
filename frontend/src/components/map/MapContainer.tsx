import { useEffect, useRef } from "react"
import maplibregl, { type StyleSpecification } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection } from "geojson"

interface MapContainerProps {
  basemap: "topographic" | "satellite"
  mapView: "2d" | "3d"
  showFires: boolean
}

const mockFireData: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.5, 42.0] },
      properties: { intensity: "high" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.2, 42.1] },
      properties: { intensity: "moderate" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [25.8, 41.8] },
      properties: { intensity: "critical" },
    },
  ],
}

const satelliteStyle: StyleSpecification = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "&copy; Esri",
    },
  },
  layers: [
    {
      id: "satellite",
      type: "raster",
      source: "esri-satellite",
    },
  ],
}

export function MapContainer({ basemap, mapView, showFires }: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)

  const injectFireData = (mapInstance: maplibregl.Map) => {
    if (mapInstance.getSource("active-fires")) return

    mapInstance.addSource("active-fires", {
      type: "geojson",
      data: mockFireData,
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

  useEffect(() => {
    if (map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current!,
      style: "https://demotiles.maplibre.org/style.json",
      center: [25.5, 42.0],
      zoom: 7,
      attributionControl: false,
    })

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-left")

    map.current.on("load", () => {
      injectFireData(map.current!)
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

      if (mapInstance.getLayer("fire-points")) {
        mapInstance.setLayoutProperty("fire-points", "visibility", showFires ? "visible" : "none")
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap])

  useEffect(() => {
    if (!map.current) return
    const mapInstance = map.current

    const applyUpdates = () => {
      mapInstance.setProjection({
        type: mapView === "3d" ? "globe" : "mercator",
      })

      mapInstance.flyTo({
        pitch: 0,
        bearing: 0,
        zoom: mapView === "3d" ? 2 : 7,
        duration: 1500,
      })

      if (mapInstance.getLayer("fire-points")) {
        mapInstance.setLayoutProperty("fire-points", "visibility", showFires ? "visible" : "none")
      }
    }

    if (mapInstance.isStyleLoaded()) {
      applyUpdates()
    } else {
      mapInstance.once("style.load", applyUpdates)
    }
  }, [mapView, showFires])

  return <div ref={mapContainer} className='h-full w-full' />
}
