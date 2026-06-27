import { useEffect, type RefObject } from "react"
import maplibregl from "maplibre-gl"
import type { FeatureCollection } from "geojson"
import { useMapStore } from "@/store/use-map-store"
import { mockEvacuationRoutes } from "@/mocks/evacuation-data"
import { mockFireData } from "@/mocks/fire-data"

function getFwiTilesUrl(isoDate: string): string[] {
  const dateStr = isoDate.split("T")[0]
  return [`/effis-wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=mf010.fwi&TIME=${dateStr}&STYLES=&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=TRUE`]
}

const EFFIS_VIIRS_TILES = [`https://maps.effis.emergency.copernicus.eu/effis` + `?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` + `&LAYERS=viirs.hs&STYLES=` + `&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256` + `&SRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=TRUE`]

/**
 * Adds all sources and layers once after initial style load.
 * Safe to call multiple times — each block guards with getSource/getLayer.
 */
export function initializeLayers(map: maplibregl.Map): void {
  const { selectedDate } = useMapStore.getState()

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
  addSource("evac-routes", { type: "geojson", data: mockEvacuationRoutes as FeatureCollection })
  addSource("active-fires", { type: "geojson", data: mockFireData as FeatureCollection })

  const addLayer = (spec: maplibregl.LayerSpecification) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec)
  }

  addLayer({ id: "effis-fwi-layer", type: "raster", source: "effis-fwi", paint: { "raster-opacity": 0.7 } })
  addLayer({ id: "effis-viirs-layer", type: "raster", source: "effis-viirs", paint: { "raster-opacity": 0.8 }, layout: { visibility: "none" } })

  addLayer({
    id: "evac-routes-line",
    type: "line",
    source: "evac-routes",
    paint: { "line-color": "#3b82f6", "line-width": 3, "line-dasharray": [2, 2] },
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
}

/** Reads current store state and sets all layer visibilities + terrain. */
export function syncLayers(map: maplibregl.Map, fireData: FeatureCollection): void {
  const { showTerrain, showRiskGrid, showFires, showEvac, showWind, showLabels } = useMapStore.getState()

  const setVis = (id: string, visible: boolean) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none")
    }
  }

  map.setTerrain(showTerrain ? { source: "3d-terrain", exaggeration: 1.5 } : null)

  setVis("effis-fwi-layer", showRiskGrid)
  setVis("effis-viirs-layer", showFires)
  setVis("evac-routes-line", showEvac)
  setVis("fire-points", showFires)
  setVis("wind-vectors-symbol", showWind)
  setVis("country-borders", showLabels)
  setVis("place-labels", showLabels)

  const src = map.getSource("active-fires") as maplibregl.GeoJSONSource | undefined
  src?.setData(fireData)
}

/**
 * Reacts to layer-visibility store changes and pushes them to MapLibre.
 * Uses a single flat dependency array — no synchronisation bugs.
 */
export function useMapLayers(mapRef: RefObject<maplibregl.Map | null>, fireDataRef: RefObject<FeatureCollection>): void {
  const { showFires, showTerrain, showLabels, showWind, showEvac, showRiskGrid, selectedDate } = useMapStore()

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    syncLayers(map, fireDataRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFires, showTerrain, showLabels, showWind, showEvac, showRiskGrid])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return

    const source = map.getSource("effis-fwi") as maplibregl.Source & { setTiles?: (tiles: string[]) => void }

    if (source && typeof source.setTiles === "function") {
      source.setTiles(getFwiTilesUrl(selectedDate))
    }
  }, [selectedDate, mapRef])
}
