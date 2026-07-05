import { useEffect } from "react"
import type { Map } from "maplibre-gl"
import { useLayerStore } from "@/store/use-layer-store"

interface HumanSettlementLayerProps {
  mapRef: React.RefObject<Map | null>
}

export function HumanSettlementLayer({ mapRef }: HumanSettlementLayerProps) {
  const showSettlement = useLayerStore((s) => s.showSettlement)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const addSettlementLayer = () => {
      // Add source if it doesn't exist
      if (!map.getSource("gwis-settlement")) {
        map.addSource("gwis-settlement", {
          type: "raster",
          tiles: [
            "gwis-settlement://gwis-wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=ghsl&STYLES=&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=TRUE",
          ],
          tileSize: 256,
          attribution: "Copernicus GWIS / JRC GHSL",
        })
      }

      // Add layer if it doesn't exist
      if (!map.getLayer("gwis-settlement-layer")) {
        map.addLayer({
          id: "gwis-settlement-layer",
          type: "raster",
          source: "gwis-settlement",
          paint: {
            "raster-opacity": 0.6,
          },
          layout: {
            visibility: showSettlement ? "visible" : "none",
          },
        })
      } else {
        // Sync visibility in case layer already exists
        map.setLayoutProperty("gwis-settlement-layer", "visibility", showSettlement ? "visible" : "none")
      }
    }

    if (map.isStyleLoaded()) {
      addSettlementLayer()
    }

    // Map events
    map.on("load", addSettlementLayer)
    map.on("styledata", addSettlementLayer)

    return () => {
      map.off("load", addSettlementLayer)
      map.off("styledata", addSettlementLayer)
    }
  }, [mapRef, showSettlement])

  return null
}
