import { useEffect, useRef, type RefObject } from "react"
import maplibregl, { type StyleSpecification } from "maplibre-gl"
import { toast } from "sonner"
import { useMapStore } from "@/store/use-map-store"
import { useUIStore } from "@/store/use-ui-store"
import { satelliteStyle } from "@/lib/map-config"
import { useFilterStore } from "@/store/use-filter-store"
import { bulgariaMercatorCoordinates, bulgariaBBoxMercator } from "@/utils/geo"

let protocolsRegistered = false

function registerCustomProtocols() {
  if (protocolsRegistered) return
  protocolsRegistered = true

  const registerProtocol = (protocol: string, schemeReplacement: string) => {
    maplibregl.addProtocol(protocol, async (params, abortController) => {
      const fetchUrl = params.url.replace(`${protocol}://`, schemeReplacement)
      const { region } = useFilterStore.getState()

      if (region !== "bulgaria") {
        const res = await fetch(fetchUrl, { signal: abortController.signal })
        if (!res.ok) throw new Error(`Failed to load tile: ${res.status}`)
        const data = await res.arrayBuffer()
        return { data }
      }

      // Extract BBOX from query parameter in EPSG:3857
      const match = params.url.match(/[?&]BBOX=([^&]+)/i)
      if (!match) {
        const res = await fetch(fetchUrl, { signal: abortController.signal })
        if (!res.ok) throw new Error(`Failed to load tile: ${res.status}`)
        return { data: await res.arrayBuffer() }
      }

      const [tMinX, tMinY, tMaxX, tMaxY] = match[1].split(",").map(Number)

      // Optimize: Check if the tile bounds are completely outside Bulgaria's bounding box
      const bbox = bulgariaBBoxMercator
      if (
        tMaxX < bbox.minX ||
        tMinX > bbox.maxX ||
        tMaxY < bbox.minY ||
        tMinY > bbox.maxY
      ) {
        // Return 1x1 transparent PNG buffer
        const transparentPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        const transparentPngBuffer = Uint8Array.from(atob(transparentPngBase64), (c) => c.charCodeAt(0)).buffer
        return { data: transparentPngBuffer }
      }

      // Fetch the original Copernicus tile
      const res = await fetch(fetchUrl, { signal: abortController.signal })
      if (!res.ok) throw new Error(`Failed to load tile: ${res.status}`)
      const blob = await res.blob()

      let img: ImageBitmap
      try {
        img = await createImageBitmap(blob)
      } catch (e) {
        // Fallback for empty or corrupted tiles
        return { data: await blob.arrayBuffer() }
      }

      // Create canvas to draw the clipped tile
      const canvas = document.createElement("canvas")
      canvas.width = 256
      canvas.height = 256
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        return { data: await blob.arrayBuffer() }
      }

      // Clip canvas path to Bulgaria border polygon
      ctx.beginPath()
      for (const ring of bulgariaMercatorCoordinates) {
        if (ring.length === 0) continue
        const [firstX, firstY] = ring[0]
        const px0 = ((firstX - tMinX) / (tMaxX - tMinX)) * 256
        const py0 = (1.0 - (firstY - tMinY) / (tMaxY - tMinY)) * 256
        ctx.moveTo(px0, py0)
        for (let i = 1; i < ring.length; i++) {
          const [x, y] = ring[i]
          const px = ((x - tMinX) / (tMaxX - tMinX)) * 256
          const py = (1.0 - (y - tMinY) / (tMaxY - tMinY)) * 256
          ctx.lineTo(px, py)
        }
        ctx.closePath()
      }
      ctx.clip()
      ctx.drawImage(img, 0, 0)

      // Convert canvas back to array buffer for MapLibre
      const clippedBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      if (!clippedBlob) {
        return { data: await blob.arrayBuffer() }
      }
      const arrayBuffer = await clippedBlob.arrayBuffer()
      return { data: arrayBuffer }
    })
  }

  // Register all protocols
  const protocols = ["effis-fwi", "effis-viirs", "effis-fuel", "gwis-settlement"]
  const replacements = ["/", "https://", "/", "/"]

  protocols.forEach((protocol, idx) => {
    try {
      registerProtocol(protocol, replacements[idx])
    } catch (e: any) {
      console.warn(`Protocol ${protocol} registration error:`, e)
      toast.warning(`Protocol ${protocol} registration error: ${e?.message || e}`)
    }
  })
}


const LIGHT_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

export function resolveMapStyle(theme: string, basemap: string): string | StyleSpecification {
  if (basemap === "satellite") return satelliteStyle
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme
  return resolved === "dark" ? DARK_STYLE : LIGHT_STYLE
}

/**
 * Creates and tears down the MapLibre instance.
 * Returns a STABLE ref via useRef — consumers should never re-create the map themselves.
 *
 * IMPORTANT: This MUST use useRef, NOT a plain `{ current: null }` object.
 * A plain object is re-created on every render, which causes all downstream
 * hooks to receive a stale null ref after the first re-render.
 */
export function useMapInit(containerRef: RefObject<HTMLDivElement | null>): RefObject<maplibregl.Map | null> {
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    registerCustomProtocols()

    // Read initial values from store without subscribing (avoids re-running the effect)
    const { camera, mapView, basemap } = useMapStore.getState()
    const { theme } = useUIStore.getState()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveMapStyle(theme, basemap),
      center: [camera.lng, camera.lat],
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    })

    mapRef.current = map
    useMapStore.getState().setMapInstance(map)

    map.once("load", () => {
      map.setProjection({
        type: mapView === "3d" ? "globe" : "mercator",
      })
    })

    // ResizeObserver keeps the canvas sized correctly without relying on
    // window resize events (handles sidebar open/close transitions too).
    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(containerRef.current!)

    return () => {
      observer.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
      useMapStore.getState().setMapInstance(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionally run once — map lifecycle is managed imperatively

  return mapRef
}
