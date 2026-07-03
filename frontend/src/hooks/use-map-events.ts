import { useEffect, useRef, type RefObject } from "react"
import maplibregl from "maplibre-gl"
import type { Point } from "geojson"
import { useMapStore } from "@/store/use-map-store"
import { useLayerStore } from "@/store/use-layer-store"
import { generateGlassPopupHTML, generateSectorPopupHTML } from "@/lib/popups"
import { lngLatTo3857 } from "@/utils/geo"
import { intensityStyle } from "@/utils/helpers"
import { fetchEffisWmsFeatureInfo } from "@/services/fireService"

/**
 * Opens a glass popup, replacing any previously open popup so they never stack.
 * The activePopup ref is shared across all callers via the module scope is
 * captured once in useMapEvents through the closure.
 */
function openPopup(
  map: maplibregl.Map,
  lngLat: [number, number],
  html: string,
  activePopupRef: React.RefObject<maplibregl.Popup | null>,
) {
  activePopupRef.current?.remove()

  activePopupRef.current = new maplibregl.Popup({
    closeButton: false,
    className: "glass-popup",
    offset: 10,
    maxWidth: "300px",
  })
    .setLngLat(lngLat)
    .setHTML(html)
    .addTo(map)
}

async function fetchEffisInfo(
  map: maplibregl.Map,
  e: maplibregl.MapMouseEvent,
  activePopupRef: React.RefObject<maplibregl.Popup | null>,
): Promise<void> {
  const { showFires, showRiskGrid } = useLayerStore.getState()
  // Only query EFFIS when a relevant layer is visible
  if (!showFires && !showRiskGrid) return

  const { lng, lat } = e.lngLat
  const canvas = map.getCanvas()

  // BBOX must be in EPSG:3857 meters — getBounds() returns geographic degrees which
  // would be treated as invalid Mercator coordinates by the WMS server.
  const b = map.getBounds()
  const [minX, minY] = lngLatTo3857(b.getWest(), b.getSouth())
  const [maxX, maxY] = lngLatTo3857(b.getEast(), b.getNorth())
  const bbox = `${minX},${minY},${maxX},${maxY}`

  // Use CSS pixel dimensions (clientWidth/clientHeight) to stay consistent with
  // e.point.x / e.point.y which are also CSS pixels. canvas.width is device pixels
  // (2× on retina) and would misalign the X/Y coordinates on high-DPI screens.
  const width = canvas.clientWidth
  const height = canvas.clientHeight

  const layer = showFires ? "viirs.hs" : "mf010.fwi"

  try {
    const text = await fetchEffisWmsFeatureInfo({
      layer,
      bbox,
      width,
      height,
      x: Math.round(e.point.x),
      y: Math.round(e.point.y),
    })

    if (text.includes("ServiceException")) {
      console.warn("WMS Service Exception:", text)
      return
    }

    console.info("WMS GetFeatureInfo Response:", text)

    if (
      !text.trim() ||
      text.includes("Search returned no results")
    ) {
      return
    }

    // Parse text/plain key=value style output
    const props: Record<string, string> = {}

    for (const line of text.split("\n")) {
      const trimmed = line.trim()

      if (!trimmed.includes("=")) continue

      const [key, ...rest] = trimmed.split("=")
      props[key.trim()] = rest.join("=").trim()
    }

    console.info("Parsed props:", props)

    if (layer === "viirs.hs") {
      const date = props.FIREDATE ? new Date(props.FIREDATE as string).toLocaleDateString() : "Live"
      const { dot, text } = intensityStyle(Number(props.FRP ?? 0))
      openPopup(
        map,
        [lng, lat],
        generateGlassPopupHTML(date, "VIIRS Sat Active Ignition", `FRP: ${props.FRP ?? "--"} MW`, [lng, lat], dot, text),
        activePopupRef,
      )
    } else {
      const riskVal = props.GRAY_INDEX ?? props.value ?? "Analyzing"
      openPopup(
        map,
        [lng, lat],
        generateSectorPopupHTML("Copernicus Macro Matrix", `FWI Rating: ${riskVal}`, 0, 0, "bg-orange-500", "text-orange-500"),
        activePopupRef,
      )
    }
  } catch (err) {
    console.warn("Empty grid location metadata requested or server processing timeout.", err)
  }
}

/**
 * Registers all MapLibre event listeners once after initial load.
 * Cleans up automatically when the map is removed.
 *
 * High-frequency updates (mousemove/zoom/rotate) bypass React state entirely
 * and write directly to the Zustand store, which BottomStatusBar and
 * MapNavigation consume via store.subscribe() — no re-renders.
 */
export function useMapEvents(mapRef: RefObject<maplibregl.Map | null>): void {
  // Single popup ref — ensures at most one popup is open at a time
  const activePopupRef = useRef<maplibregl.Popup | null>(null)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const onEnterFire = () => {
      map.getCanvas().style.cursor = "pointer"
    }
    const onLeaveFire = () => {
      map.getCanvas().style.cursor = ""
    }
    map.on("mouseenter", "fire-points", onEnterFire)
    map.on("mouseleave", "fire-points", onLeaveFire)

    const onClickFire = (e: maplibregl.MapLayerMouseEvent) => {
      e.originalEvent.stopPropagation()
      const feature = e.features?.[0]
      if (!feature) return

      const coords = [...(feature.geometry as Point).coordinates] as [number, number]
      while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
        coords[0] += e.lngLat.lng > coords[0] ? 360 : -360
      }

      const { intensity = "unknown", title = "Unknown Fire", date } = feature.properties ?? {}
      const displayDate = date ? new Date(date as string).toLocaleDateString() : "Live"
      const { dot, text } = intensityStyle(intensity === "critical" ? 100 : intensity === "high" ? 30 : 10)

      openPopup(
        map,
        coords,
        generateGlassPopupHTML(displayDate, title as string, intensity as string, coords, dot, text),
        activePopupRef,
      )
    }
    map.on("click", "fire-points", onClickFire)

    const onClickMap = (e: maplibregl.MapMouseEvent) => void fetchEffisInfo(map, e, activePopupRef)
    map.on("click", onClickMap)

    let ticking = false
    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const elevation = Math.round(map.queryTerrainElevation(e.lngLat) ?? 0)
        useMapStore.getState().setMapStatus({
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          elevation,
        })
        ticking = false
      })
    }
    map.on("mousemove", onMouseMove)

    const onZoom = () => {
      useMapStore.getState().setMapStatus({ zoom: map.getZoom() })
    }
    map.on("zoom", onZoom)

    const onRotate = () => {
      useMapStore.getState().setMapStatus({ bearing: map.getBearing() })
    }
    map.on("rotate", onRotate)

    const onMoveEnd = () => {
      useMapStore.getState().setCamera({
        lng: map.getCenter().lng,
        lat: map.getCenter().lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      })
    }
    map.on("moveend", onMoveEnd)

    return () => {
      // Remove any open popup when the map tears down
      activePopupRef.current?.remove()
      activePopupRef.current = null

      map.off("mouseenter", "fire-points", onEnterFire)
      map.off("mouseleave", "fire-points", onLeaveFire)
      map.off("click", "fire-points", onClickFire)
      map.off("click", onClickMap)
      map.off("mousemove", onMouseMove)
      map.off("zoom", onZoom)
      map.off("rotate", onRotate)
      map.off("moveend", onMoveEnd)
    }
  }, [mapRef])
}
