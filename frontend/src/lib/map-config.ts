import type { StyleSpecification } from "maplibre-gl"

export const satelliteStyle: StyleSpecification = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "&copy; Esri",
    },
    "vector-overlays": {
      type: "vector",
      url: "https://demotiles.maplibre.org/tiles/tiles.json",
    },
  },
  layers: [
    {
      id: "satellite-base",
      type: "raster",
      source: "esri-satellite",
    },
    {
      id: "country-borders",
      type: "line",
      source: "vector-overlays",
      "source-layer": "countries",
      paint: {
        "line-color": "#ffffff",
        "line-width": 1.2,
        "line-opacity": 0.4,
        "line-dasharray": [2, 2],
      },
      layout: { visibility: "none" },
    },
    {
      id: "place-labels",
      type: "symbol",
      source: "vector-overlays",
      "source-layer": "countries",
      layout: {
        "text-field": "{name}",
        "text-font": ["Open Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 8, 16],
        visibility: "none",
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "#000000",
        "text-halo-width": 1.5,
        "text-halo-blur": 1,
      },
    },
  ],
}

export const EFFIS_LEGENDS = {
  fwi: "http://maps.effis.emergency.copernicus.eu/effis?language=eng&version=1.1.1&service=WMS&request=GetLegendGraphic&layer=mf010.fwi&format=image/png&STYLE=default",
  viirs: "http://maps.effis.emergency.copernicus.eu/effis?language=eng&version=1.1.1&service=WMS&request=GetLegendGraphic&layer=viirs.hs&format=image/png&STYLE=default",
}
