import { useEffect, useRef } from "react"
import maplibregl, { type StyleSpecification } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection, Point } from "geojson"

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
      const mapInstance = map.current!
      injectFireData(mapInstance)

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

        const popupHtml = `
          <div class="font-sans max-w-[220px]">
            <div class="flex items-center justify-between mb-1.5">
              <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">${date}</div>
              <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">EFFIS</div>
            </div>
            <div class="font-bold text-sm mb-2 text-foreground leading-tight">${title}</div>
            <div class="flex items-center gap-2 mb-3">
              <div class="w-2.5 h-2.5 rounded-full ${dotColor} border border-white/20 shadow-sm"></div>
              <span class="text-xs font-bold capitalize ${textColor}">${intensity} Risk</span>
            </div>
            <div class="text-xs text-muted-foreground border-t border-border/50 pt-2">
              <div class="flex justify-between gap-4 mb-1">
                <span class="font-semibold text-foreground/70">Lat:</span>
                <span class="font-mono text-foreground">${coordinates[1].toFixed(4)}°</span>
              </div>
              <div class="flex justify-between gap-4">
                <span class="font-semibold text-foreground/70">Lon:</span>
                <span class="font-mono text-foreground">${coordinates[0].toFixed(4)}°</span>
              </div>
            </div>
          </div>
        `

        new maplibregl.Popup({
          closeButton: false,
          className: "glass-popup",
          offset: 10,
        })
          .setLngLat(coordinates as [number, number])
          .setHTML(popupHtml)
          .addTo(mapInstance)
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

    const applyUpdates = () => {
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
