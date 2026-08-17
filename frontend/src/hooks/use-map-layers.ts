import { useEffect, type RefObject } from "react"
import maplibregl from "maplibre-gl"
import type { FeatureCollection } from "geojson"
import { useLayerStore } from "@/store/use-layer-store"
import { useFilterStore } from "@/store/use-filter-store"
import { useMapStore } from "@/store/use-map-store"
import { isPointInPolygon, bulgariaBorder } from "@/utils/geo"

function getFwiTilesUrl(isoDate: string): string[] {
  const dateStr = isoDate.split("T")[0]
  return [`effis-fwi://effis-wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=mf010.fwi&TIME=${dateStr}&STYLES=&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=TRUE`]
}

const EFFIS_VIIRS_TILES = [
  `effis-viirs://maps.effis.emergency.copernicus.eu/effis` +
  `?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
  `&LAYERS=viirs.hs&STYLES=` +
  `&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256` +
  `&SRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=TRUE`,
]

/**
 * Adds all sources and layers once after initial style load.
 * Safe to call multiple times — each block guards with getSource/getLayer.
 */
export function initializeLayers(map: maplibregl.Map): void {
  const { selectedDate } = useFilterStore.getState()

  const addSource = (id: string, spec: maplibregl.SourceSpecification) => {
    if (!map.getSource(id)) map.addSource(id, spec)
  }

  addSource("3d-terrain", {
    type: "raster-dem",
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 14,
  })
  addSource("effis-fwi", { type: "raster", tiles: getFwiTilesUrl(selectedDate), tileSize: 256, attribution: "Copernicus EFFIS" })
  addSource("effis-viirs", { type: "raster", tiles: EFFIS_VIIRS_TILES, tileSize: 256, attribution: "Copernicus EFFIS" })
  // Wiser's own risk model. Empty until useRiskZones loads it from the backend.
  addSource("risk-zones", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
  // Starts empty on purpose - routes only ever come from the backend, which computes
  // them from the real road network and excludes roads running beside active fires.
  addSource("evac-routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
  // Empty until useFireData loads real detections - the map must never show a fire
  // that is not actually burning.
  addSource("active-fires", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
  addSource("user-location", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  })

  const addLayer = (spec: maplibregl.LayerSpecification) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec)
  }

  addLayer({ id: "effis-fwi-layer", type: "raster", source: "effis-fwi", paint: { "raster-opacity": 0.7 } })
  addLayer({ id: "effis-viirs-layer", type: "raster", source: "effis-viirs", paint: { "raster-opacity": 0.8 }, layout: { visibility: "none" } })

  // Wiser's own risk zones sit directly above the EFFIS raster so the two models can
  // be compared by toggling between them. The colours are deliberately the EFFIS
  // palette: same six-class scale, so any difference on screen is model, not styling.
  addLayer({
    id: "risk-zones-fill",
    type: "fill",
    source: "risk-zones",
    layout: { visibility: "none" },
    paint: {
      "fill-color": [
        "match",
        ["get", "riskClass"],
        1, "#a0ffc3",
        2, "#cfe355",
        3, "#e7af0a",
        4, "#dc7719",
        5, "#b01117",
        6, "#41091f",
        "#a0ffc3",
      ],
      "fill-opacity": 0.55,
    },
  })

  // A faint cell boundary: without it 2772 adjacent squares read as a single blur and
  // the grid resolution of the model is invisible.
  addLayer({
    id: "risk-zones-outline",
    type: "line",
    source: "risk-zones",
    layout: { visibility: "none" },
    paint: { "line-color": "#ffffff", "line-width": 0.4, "line-opacity": 0.25 },
  })

  // Drawn as a solid casing under a bright core so the corridor stays legible over
  // satellite imagery, where a thin dashed line disappears into the terrain.
  addLayer({
    id: "evac-routes-casing",
    type: "line",
    source: "evac-routes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#0f172a",
      "line-width": ["interpolate", ["linear"], ["zoom"], 6, 4, 14, 10],
      "line-opacity": 0.7,
    },
  })

  addLayer({
    id: "evac-routes-line",
    type: "line",
    source: "evac-routes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#22d3ee",
      "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2, 14, 6],
    },
  })

  addLayer({
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

  addLayer({
    id: "user-location-accuracy",
    type: "circle",
    source: "user-location",
    paint: {
      "circle-radius": 20,
      "circle-color": "#3b82f6",
      "circle-opacity": 0.15,
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#3b82f6",
    },
  })

  addLayer({
    id: "user-location-layer",
    type: "circle",
    source: "user-location",
    paint: {
      "circle-radius": 8,
      "circle-color": "#3b82f6",
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff",
    },
  })
}

/** Reads current store state and sets all layer visibilities + terrain. */
export function syncLayers(map: maplibregl.Map, fireData: FeatureCollection): void {
  const { showTerrain, showRiskGrid, showRiskZones, showFires, showEvac, showLabels } = useLayerStore.getState()

  const setVis = (id: string, visible: boolean) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none")
    }
  }

  map.setTerrain(showTerrain ? { source: "3d-terrain", exaggeration: 1.5 } : null)

  setVis("effis-fwi-layer", showRiskGrid)
  setVis("risk-zones-fill", showRiskZones)
  setVis("risk-zones-outline", showRiskZones)
  setVis("effis-viirs-layer", showFires)
  setVis("evac-routes-casing", showEvac)
  setVis("evac-routes-line", showEvac)
  setVis("fire-points", showFires)
  setVis("country-borders", showLabels)
  setVis("place-labels", showLabels)

  // Detections outside the national border are dropped rather than drawn: the system
  // monitors Bulgaria, and a fire it will never dispatch anyone to is noise on the map.
  const filteredFireData: FeatureCollection = {
    ...fireData,
    features: fireData.features.filter((f) => {
      if (f.geometry.type === "Point") {
        const coords = f.geometry.coordinates as [number, number]
        return isPointInPolygon(coords, bulgariaBorder)
      }
      return false
    }),
  }

  const src = map.getSource("active-fires") as maplibregl.GeoJSONSource | undefined
  src?.setData(filteredFireData)

  // Evacuation routes are owned by useEvacuationRoutes, which fetches them per user
  // position - re-syncing layers must not overwrite what it loaded.

  // Restore user location data if available
  const { userLocation } = useMapStore.getState()
  if (userLocation) {
    const userSrc = map.getSource("user-location") as maplibregl.GeoJSONSource | undefined
    userSrc?.setData({
      type: "Feature",
      geometry: { type: "Point", coordinates: [userLocation.lng, userLocation.lat] },
      properties: {},
    })
  }
}

/**
 * Reacts to layer-visibility store changes and pushes them to MapLibre.
 * Uses a single flat dependency array — no synchronisation bugs.
 */
export function useMapLayers(mapRef: RefObject<maplibregl.Map | null>, fireDataRef: RefObject<FeatureCollection>): void {
  const { showFires, showTerrain, showLabels, showWind, showEvac, showRiskGrid, showRiskZones } = useLayerStore()
  const { selectedDate } = useFilterStore()

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    syncLayers(map, fireDataRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFires, showTerrain, showLabels, showWind, showEvac, showRiskGrid, showRiskZones])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return

    const fwiSource = map.getSource("effis-fwi") as maplibregl.Source & { setTiles?: (tiles: string[]) => void }
    if (fwiSource && typeof fwiSource.setTiles === "function") {
      fwiSource.setTiles(getFwiTilesUrl(selectedDate))
    }

    const viirsSource = map.getSource("effis-viirs") as maplibregl.Source & { setTiles?: (tiles: string[]) => void }
    if (viirsSource && typeof viirsSource.setTiles === "function") {
      viirsSource.setTiles(EFFIS_VIIRS_TILES)
    }
  }, [selectedDate, mapRef])
}
