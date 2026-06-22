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
      "source-layer": "place",
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

export const generateGlassPopupHTML = (date: string, title: string, intensity: string, coordinates: number[], dotColor: string, textColor: string) => `
    <div class="font-sans max-w-56 p-4 rounded-2xl bg-background/60 backdrop-blur-xl shadow-lg border-white/10 border-t-white/20 border-l-white/20">
    <div class="flex items-center justify-between mb-1.5">
        <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">${date}</div>
        <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/20 backdrop-blur-sm px-1.5 py-0.5 rounded-xl border border-border/10">EFFIS</div>
    </div>
    
    <div class="font-bold text-sm mb-2 text-foreground leading-tight">${title}</div>

    <div class="flex items-center gap-2 mb-3">
        <div class="w-2.5 h-2.5 rounded-full ${dotColor} border border-white/10 border-t-white/20 border-l-white/20 shadow-sm"></div>
        <span class="text-xs font-bold capitalize ${textColor}">${intensity} Risk</span>
    </div>

    <div class="text-xs text-muted-foreground border-t border-white/10 pt-2 mt-1">
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
