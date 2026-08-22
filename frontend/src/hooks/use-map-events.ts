import { useEffect, useRef, type RefObject } from "react"
import maplibregl from "maplibre-gl"
import { toast } from "sonner"
import type { Point } from "geojson"
import { useMapStore } from "@/store/use-map-store"
import { useLayerStore } from "@/store/use-layer-store"
import { useFilterStore } from "@/store/use-filter-store"
import { generateGlassPopupHTML, generateRiskZonePopupHTML } from "@/lib/popups"
import { lngLatToMercator } from "@/utils/geo"
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
  // Only the hotspot layer is asked, and only when it is on screen.
  //
  // Two reasons this shrank. It used to key off showFires, which now controls our own
  // detection points, so it queried the hotspot layer while that raster was hidden. And
  // it fell back to mf010.fwi, which EFFIS declares `queryable="0"` in GetCapabilities -
  // that request could never return anything, whatever was clicked. The fire weather
  // value per cell is already in our own risk zone popup, from our own database.
  const { showThermal } = useLayerStore.getState()
  if (!showThermal) return
  const layer = "viirs.hs"

  // Our own vector layers answer for themselves and have already opened their popup.
  // Without this the EFFIS round-trip would land a moment later and replace it.
  const ownFeatures = map.queryRenderedFeatures(e.point, {
    layers: ["risk-zones-fill", "fire-points"].filter((id) => map.getLayer(id)),
  })
  if (ownFeatures.length > 0) return

  const { lng, lat } = e.lngLat

  // A small window centred on the click, not the whole viewport.
  //
  // The viewport version derived its BBOX from getBounds(), which describes the visible
  // ground but says nothing about where a pixel sits once the camera is pitched, rotated
  // or on the globe projection - so X/Y pointed somewhere other than where the click
  // landed and the server answered about the wrong ground. Unprojecting two corners of a
  // box around the click is correct under any camera, and puts the click dead centre of
  // the query image where the server's hit tolerance is.
  const HALF_PX = 30
  const sw = map.unproject([e.point.x - HALF_PX, e.point.y + HALF_PX])
  const ne = map.unproject([e.point.x + HALF_PX, e.point.y - HALF_PX])
  const [minX, minY] = lngLatToMercator(sw.lng, sw.lat)
  const [maxX, maxY] = lngLatToMercator(ne.lng, ne.lat)
  const bbox = `${minX},${minY},${maxX},${maxY}`
  const size = HALF_PX * 2 + 1

  try {
    const text = await fetchEffisWmsFeatureInfo({
      layer,
      bbox,
      width: size,
      height: size,
      x: HALF_PX,
      y: HALF_PX,
      time: useFilterStore.getState().selectedDate.split("T")[0],
    })

    if (text.includes("ServiceException")) {
      console.warn("WMS Service Exception:", text)
      toast.warning("WMS Service Exception occurred")
      return
    }

    if (!text.trim() || text.includes("Search returned no results")) {
      // Said once, in plain words. This used to dump the raw WMS response into a toast
      // on every single click, which is how a miss looked like a system error.
      toast.info("No Copernicus hotspot there", {
        description: "EFFIS records its own detections, which are not the ones we ingest. Ours are the red circles.",
      })
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

    {
      const date = props.FIREDATE ? new Date(props.FIREDATE as string).toLocaleDateString() : "Live"
      const { dot, text } = intensityStyle(Number(props.FRP ?? 0))
      openPopup(
        map,
        [lng, lat],
        generateGlassPopupHTML(date, "VIIRS Sat Active Ignition", `FRP: ${props.FRP ?? "--"} MW`, [lng, lat], dot, text),
        activePopupRef,
      )
    }
  } catch (err) {
    console.warn("Empty grid location metadata requested or server processing timeout.", err)
    toast.warning("Failed to retrieve map grid metadata")
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

    const onEnterZone = () => {
      map.getCanvas().style.cursor = "pointer"
    }
    const onLeaveZone = () => {
      map.getCanvas().style.cursor = ""
    }
    map.on("mouseenter", "risk-zones-fill", onEnterZone)
    map.on("mouseleave", "risk-zones-fill", onLeaveZone)

    // Unlike the EFFIS raster, our zones are real features, so a click can report the
    // model that produced the cell instead of guessing from a pixel colour.
    const onClickZone = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature) return

      const p = feature.properties ?? {}
      openPopup(
        map,
        [e.lngLat.lng, e.lngLat.lat],
        generateRiskZonePopupHTML({
          riskClass: Number(p.riskClass ?? 0),
          fwiClass: Number(p.fwiClass ?? 0),
          fwiValue: typeof p.fwiValue === "number" ? p.fwiValue : null,
          ndviMean: typeof p.ndviMean === "number" ? p.ndviMean : null,
          fuelType: typeof p.fuelType === "number" ? p.fuelType : null,
          validDate: String(p.validDate ?? ""),
        }),
        activePopupRef,
      )
    }
    map.on("click", "risk-zones-fill", onClickZone)

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

    const onMove = () => {
      const zoom = map.getZoom()
      const bearing = map.getBearing()
      const pitch = map.getPitch()
      const pitchInRadians = (pitch * Math.PI) / 180

      // Calculate meters per pixel at the map center using map projection
      // (identical to how MapScale calculates visual distance)
      let metersPerPixel = 1
      const center = map.getCenter()
      if (
        center &&
        typeof map.project === "function" &&
        typeof map.unproject === "function" &&
        typeof center.distanceTo === "function"
      ) {
        const centerPx = map.project(center)
        if (centerPx) {
          const edge = map.unproject([centerPx.x + 100, centerPx.y])
          if (edge) {
            const distance = center.distanceTo(edge)
            if (!isNaN(distance) && distance > 0) {
              metersPerPixel = distance / 100
            }
          }
        }
      }

      // Calculate camera altitude in meters above sea level
      const cameraToCenterDistance = map.transform?.cameraToCenterDistance || 0
      const cameraAltitude = Math.cos(pitchInRadians) * cameraToCenterDistance * metersPerPixel

      const centerElevation = typeof map.queryTerrainElevation === "function"
        ? (map.queryTerrainElevation(center) || 0)
        : 0
      const cameraDistance = Math.max(0, cameraAltitude - centerElevation)

      useMapStore.getState().setMapStatus({
        zoom,
        bearing,
        cameraDistance,
      })
    }
    map.on("move", onMove)
    onMove()

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
      map.off("mouseenter", "risk-zones-fill", onEnterZone)
      map.off("mouseleave", "risk-zones-fill", onLeaveZone)
      map.off("click", "risk-zones-fill", onClickZone)
      map.off("click", onClickMap)
      map.off("mousemove", onMouseMove)
      map.off("move", onMove)
      map.off("moveend", onMoveEnd)
    }
  }, [mapRef])
}
