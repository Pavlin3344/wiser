import { useEffect } from "react"
import type { Map } from "maplibre-gl"
import { useLayerStore } from "@/store/use-layer-store"

interface FuelLayerProps {
  mapRef: React.RefObject<Map | null>
}

export function FuelLayer({ mapRef }: FuelLayerProps) {
  const showFuel = useLayerStore((s) => s.showFuel)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const addFuelLayer = () => {
      // Add source if it doesn't exist
      if (!map.getSource("effis-fuel")) {
        map.addSource("effis-fuel", {
          type: "raster",
          tiles: [
            "effis-fuel://effis-wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=fuel_map&STYLES=&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=TRUE",
          ],
          tileSize: 256,
          attribution: "Copernicus EFFIS",
        })
      }

      // Add layer if it doesn't exist
      if (!map.getLayer("effis-fuel-layer")) {
        map.addLayer({
          id: "effis-fuel-layer",
          type: "raster",
          source: "effis-fuel",
          paint: {
            "raster-opacity": 0.7,
          },
          layout: {
            visibility: showFuel ? "visible" : "none",
          },
        })
      } else {
        // Sync visibility in case layer already exists
        map.setLayoutProperty("effis-fuel-layer", "visibility", showFuel ? "visible" : "none")
      }
    }

    if (map.isStyleLoaded()) {
      addFuelLayer()
    }

    // Map events
    map.on("load", addFuelLayer)
    map.on("styledata", addFuelLayer)

    return () => {
      map.off("load", addFuelLayer)
      map.off("styledata", addFuelLayer)
    }
  }, [mapRef, showFuel])

  return null
}
