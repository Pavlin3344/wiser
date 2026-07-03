import { useEffect, useRef, useState } from "react"
import type { Map } from "maplibre-gl"
import { useUIStore } from "@/store/use-ui-store"
import { useSidebar } from "@/components/ui/sidebar"

interface Particle {
  lng: number
  lat: number
  prevX: number | null
  prevY: number | null
  age: number
  life: number
}

interface GridPoint {
  u: number
  v: number
  speed: number
}

interface WindGrid {
  west: number
  south: number
  east: number
  north: number
  zoom: number
  latStep: number
  lngStep: number
  rows: number
  cols: number
  data: GridPoint[][]
}

interface CachedWindGrid extends WindGrid {
  timestamp: number
}

interface WindLayerProps {
  mapRef: React.RefObject<Map | null>
}

// Simulated wind vector field generator (fallback when offline or rate limited)
function getMathWindVector(lng: number, lat: number, time: number): [number, number] {
  if (isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
    return [2.5, 0.3]
  }
  let u = 2.5
  let v = 0.3

  // Cyclone 1 (Low pressure system over central Europe)
  const c1Lng = 15.0 + Math.sin(time * 0.0003) * 6.0
  const c1Lat = 42.0 + Math.cos(time * 0.0002) * 4.0
  const dx1 = lng - c1Lng
  const dy1 = lat - c1Lat
  const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
  if (dist1 < 25) {
    const strength1 = 15.0 / (dist1 + 3.0)
    u += (-dy1 - dx1 * 0.15) * strength1
    v += (dx1 - dy1 * 0.15) * strength1
  }

  // Anticyclone 2 (High pressure system over Atlantic)
  const c2Lng = -5.0 + Math.cos(time * 0.00015) * 5.0
  const c2Lat = 50.0 + Math.sin(time * 0.00025) * 3.0
  const dx2 = lng - c2Lng
  const dy2 = lat - c2Lat
  const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
  if (dist2 < 30) {
    const strength2 = 12.0 / (dist2 + 4.0)
    u += (dy2 + dx2 * 0.1) * strength2
    v += (-dx2 + dy2 * 0.1) * strength2
  }

  // Add wave structures
  const scale1 = 0.3
  const scale2 = 0.7
  u += Math.sin(lng * scale1 + time * 0.001) * Math.cos(lat * scale1) * 2.0
  v += Math.cos(lng * scale2 - time * 0.0008) * Math.sin(lat * scale2) * 1.5

  return [u, v]
}

// Perform bilinear interpolation to lookup wind vector at particle's current coordinate
function getGridWind(lng: number, lat: number, grid: WindGrid): [number, number] | null {
  if (isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
    return null
  }
  const { west, south, east, latStep, lngStep, rows, cols, data } = grid

  // Handle wraps across International Date Line
  let particleLng = lng
  if (particleLng < west) particleLng += 360
  if (particleLng > east) particleLng -= 360

  // Calculate fractional coordinates in grid
  const col = (particleLng - west) / lngStep
  const row = (lat - south) / latStep

  // Check if coordinate is outside grid
  if (col < 0 || col > cols - 1 || row < 0 || row > rows - 1) {
    return null
  }

  const c0 = Math.floor(col)
  const c1 = Math.min(c0 + 1, cols - 1)
  const r0 = Math.floor(row)
  const r1 = Math.min(r0 + 1, rows - 1)

  const tx = col - c0
  const ty = row - r0

  const p00 = data[r0]?.[c0]
  const p10 = data[r0]?.[c1]
  const p01 = data[r1]?.[c0]
  const p11 = data[r1]?.[c1]

  if (!p00 || !p10 || !p01 || !p11) return null

  // Bilinear interpolation
  const u = (p00.u * (1 - tx) + p10.u * tx) * (1 - ty) + (p01.u * (1 - tx) + p11.u * tx) * ty
  const v = (p00.v * (1 - tx) + p10.v * tx) * (1 - ty) + (p01.v * (1 - tx) + p11.v * tx) * ty

  return [u, v]
}

function getWindColor(speed: number, theme: "light" | "dark"): string {
  if (theme === "dark") {
    if (speed < 2.0) {
      return "rgba(160, 210, 255, 0.45)" // pale cyan/blue
    } else if (speed < 4.5) {
      return "rgba(100, 255, 200, 0.65)" // vibrant mint green
    } else if (speed < 8.0) {
      return "rgba(255, 235, 100, 0.8)"  // yellow
    } else if (speed < 12.0) {
      return "rgba(255, 140, 50, 0.9)"   // orange
    } else {
      return "rgba(255, 50, 120, 0.95)"  // magenta
    }
  } else {
    // Light theme - darker colors for contrast
    if (speed < 2.0) {
      return "rgba(70, 130, 180, 0.4)"   // steel blue
    } else if (speed < 4.5) {
      return "rgba(46, 139, 87, 0.6)"    // sea green
    } else if (speed < 8.0) {
      return "rgba(218, 165, 32, 0.75)"  // goldenrod
    } else if (speed < 12.0) {
      return "rgba(220, 80, 20, 0.85)"   // rust orange
    } else {
      return "rgba(180, 0, 80, 0.9)"     // deep crimson
    }
  }
}

export function WindLayer({ mapRef }: WindLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mapReady, setMapReady] = useState(false)

  const theme = useUIStore((s) => s.theme)
  const { open: sidebarOpen } = useSidebar()

  // Real weather data state
  const gridRef = useRef<WindGrid | null>(null)

  // 15-Minute Local Memory Cache (caching grid matrices by geographic coordinates and time)
  const cachedGridsRef = useRef<CachedWindGrid[]>([])
  const WIND_CACHE_LIFETIME = 15 * 60 * 1000 // 15 mins

  // Concurrency Limiter: Ensures we never trigger parallel fetches (max 1 concurrent call per IP)
  const isFetchingRef = useRef(false)

  const [status, setStatus] = useState<"syncing" | "live" | "offline" | "ratelimit">("syncing")
  const statusRef = useRef(status)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const [speedRange, setSpeedRange] = useState<{ min: number; max: number } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const particles = useRef<Particle[]>([])
  const particleCount = 1500
  const dimensions = useRef({ width: 0, height: 0 })

  // Poll until map instance is fully set in ref
  useEffect(() => {
    if (mapRef.current) {
      setMapReady(true)
      return
    }

    const interval = setInterval(() => {
      if (mapRef.current) {
        setMapReady(true)
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [mapRef])

  const resizeCanvas = () => {
    const canvas = canvasRef.current
    const map = mapRef.current
    if (!canvas || !map) return

    const container = map.getContainer()
    const width = container.clientWidth
    const height = container.clientHeight
    const dpr = window.devicePixelRatio || 1

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)
    }

    dimensions.current = { width, height }
  }

  const initParticles = (width: number, height: number, map: Map) => {
    const arr: Particle[] = []
    const center = map.getCenter()
    for (let i = 0; i < particleCount; i++) {
      const rx = Math.random() * width
      const ry = Math.random() * height
      try {
        const lngLat = map.unproject([rx, ry])
        if (lngLat && !isNaN(lngLat.lng) && !isNaN(lngLat.lat) && isFinite(lngLat.lng) && isFinite(lngLat.lat)) {
          arr.push({
            lng: lngLat.lng,
            lat: lngLat.lat,
            prevX: null,
            prevY: null,
            age: 0,
            life: Math.random() * 80 + 40,
          })
        } else {
          arr.push({
            lng: center?.lng ?? 0,
            lat: center?.lat ?? 0,
            prevX: null,
            prevY: null,
            age: 0,
            life: Math.random() * 80 + 40,
          })
        }
      } catch (e) {
        arr.push({
          lng: center?.lng ?? 0,
          lat: center?.lat ?? 0,
          prevX: null,
          prevY: null,
          age: 0,
          life: Math.random() * 80 + 40,
        })
      }
    }
    particles.current = arr
  }

  // Fetch real wind data for the current viewport from Open-Meteo
  const fetchWindData = async () => {
    const map = mapRef.current
    if (!map) return

    // A. Concurrency Limiter: Enforce sequential request processing (max 1 active fetch)
    if (isFetchingRef.current) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      // Re-schedule this execution sequentially once the previous connection finishes aborting
      setTimeout(fetchWindData, 200)
      return
    }

    const center = map.getCenter()
    const currentZoom = map.getZoom()

    // Validate that center and zoom are valid numbers before querying API
    if (!center || isNaN(center.lng) || isNaN(center.lat) || typeof currentZoom !== "number" || isNaN(currentZoom)) {
      console.warn("Map center or zoom is invalid, skipping wind data fetch.")
      return
    }

    const degreeSpanLng = Math.max(120 / Math.pow(1.5, Math.max(currentZoom - 2, 0)), 8)
    const degreeSpanLat = Math.max(80 / Math.pow(1.5, Math.max(currentZoom - 2, 0)), 6)

    const west = center.lng - degreeSpanLng / 2
    const east = center.lng + degreeSpanLng / 2
    const south = Math.max(center.lat - degreeSpanLat / 2, -80)
    const north = Math.min(center.lat + degreeSpanLat / 2, 80)

    // B. Local Memory Cache Lookup: Check if we have a valid, recent grid that covers this area
    const now = Date.now()
    const matchingCachedGrid = cachedGridsRef.current.find((grid) => {
      // Must be recent
      if (now - grid.timestamp > WIND_CACHE_LIFETIME) return false

      // Zoom level must be close (within 1.0 unit)
      if (Math.abs(currentZoom - grid.zoom) >= 1.0) return false

      // Bounding box must fully contain the current map center with a 10% safety margin
      const padLng = (grid.east - grid.west) * 0.1
      const padLat = (grid.north - grid.south) * 0.1

      return (
        center.lng >= grid.west + padLng &&
        center.lng <= grid.east - padLng &&
        center.lat >= grid.south + padLat &&
        center.lat <= grid.north - padLat
      )
    })

    if (matchingCachedGrid) {
      console.info("Found matching wind grid in memory cache. Skipping API call.")
      gridRef.current = matchingCachedGrid

      // Compute speed range for the indicator
      let minSpeed = Infinity
      let maxSpeed = -Infinity
      matchingCachedGrid.data.forEach((row) => {
        row.forEach((pt) => {
          if (pt.speed < minSpeed) minSpeed = pt.speed
          if (pt.speed > maxSpeed) maxSpeed = pt.speed
        })
      })

      setSpeedRange({ min: minSpeed === Infinity ? 0 : minSpeed, max: maxSpeed === -Infinity ? 0 : maxSpeed })
      setStatus("live")
      return
    }

    // C. Spatial Throttling: Check if center drift is minor compared to the currently loaded grid
    const currentGrid = gridRef.current
    if (currentGrid) {
      const gridCenterLng = (currentGrid.west + currentGrid.east) / 2
      const gridCenterLat = (currentGrid.south + currentGrid.north) / 2

      const lngSpan = currentGrid.east - currentGrid.west
      const latSpan = currentGrid.north - currentGrid.south

      const deltaLng = Math.abs(center.lng - gridCenterLng)
      const deltaLat = Math.abs(center.lat - gridCenterLat)
      const zoomDiff = Math.abs(currentZoom - currentGrid.zoom)

      if (deltaLng < lngSpan * 0.3 && deltaLat < latSpan * 0.3 && zoomDiff < 1.0) {
        console.info("Reusing active wind grid. Center drift and zoom change are minor.")
        if (status === "syncing") setStatus("live")
        return
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setStatus("syncing")
    isFetchingRef.current = true

    try {
      let lngDiff = east - west
      if (lngDiff <= 0) lngDiff = 360
      if (lngDiff > 360) lngDiff = 360

      const GRID_ROWS = 12
      const GRID_COLS = 12
      const lats: number[] = []
      const lngs: number[] = []
      const latStep = (north - south) / (GRID_ROWS - 1)
      const lngStep = lngDiff / (GRID_COLS - 1)

      for (let r = 0; r < GRID_ROWS; r++) {
        const lat = south + r * latStep
        for (let c = 0; c < GRID_COLS; c++) {
          let lng = west + c * lngStep
          lng = ((lng + 180) % 360) - 180
          if (lng < -180) lng += 360

          lats.push(lat)
          lngs.push(lng)
        }
      }

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}&longitude=${lngs.join(",")}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`

      const res = await fetch(url, { signal: abortControllerRef.current.signal })

      // Catch 429 Too Many Requests
      if (res.status === 429) {
        console.warn("Open-Meteo API rate limit reached (429). Falling back to simulation.")
        setStatus("ratelimit")
        return
      }

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`)
      }

      const data = await res.json()

      const gridData: GridPoint[][] = []
      let minSpeed = Infinity
      let maxSpeed = -Infinity

      for (let r = 0; r < GRID_ROWS; r++) {
        gridData[r] = []
        for (let c = 0; c < GRID_COLS; c++) {
          const idx = r * GRID_COLS + c
          const item = Array.isArray(data) ? data[idx] : data
          const current = item?.current
          const speed = current?.wind_speed_10m ?? 0
          const dir = current?.wind_direction_10m ?? 0

          if (speed < minSpeed) minSpeed = speed
          if (speed > maxSpeed) maxSpeed = speed

          // Convert direction (from North, clockwise) to velocity vector
          const theta = (dir * Math.PI) / 180
          const u = -speed * Math.sin(theta)
          const v = -speed * Math.cos(theta)

          gridData[r][c] = { u, v, speed }
        }
      }

      const newGrid: CachedWindGrid = {
        west,
        south,
        east,
        north,
        zoom: currentZoom,
        latStep,
        lngStep,
        rows: GRID_ROWS,
        cols: GRID_COLS,
        data: gridData,
        timestamp: Date.now(),
      }

      gridRef.current = newGrid

      // Save to local cache list, keep only entries under 15 mins, and slice to max 10 entries
      cachedGridsRef.current = [
        newGrid,
        ...cachedGridsRef.current.filter((g) => Date.now() - g.timestamp < WIND_CACHE_LIFETIME),
      ].slice(0, 10)

      setSpeedRange({ min: minSpeed === Infinity ? 0 : minSpeed, max: maxSpeed === -Infinity ? 0 : maxSpeed })
      setStatus("live")
    } catch (err: any) {
      if (err.name === "AbortError") return
      console.warn("Failed to fetch real wind data from Open-Meteo:", err)
      setStatus("offline")
    } finally {
      isFetchingRef.current = false
    }
  }

  useEffect(() => {
    if (!mapReady) return

    const map = mapRef.current
    if (!map) return

    // Initial fetch
    fetchWindData()

    resizeCanvas()

    const { width, height } = dimensions.current
    if (particles.current.length === 0 && width > 0 && height > 0) {
      initParticles(width, height, map)
    }

    let animationFrameId: number

    const animate = (timestamp: number) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const { width: w, height: h } = dimensions.current
      if (w === 0 || h === 0) {
        animationFrameId = requestAnimationFrame(animate)
        return
      }

      // If particles were not initialized (e.g. because dimensions were 0 initially), initialize them now
      if (particles.current.length === 0) {
        initParticles(w, h, map)
      }

      // 1. Fade previous frame to create smooth, transparent trails
      ctx.globalCompositeOperation = "destination-out"
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)"
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = "source-over"

      const rawZoom = map.getZoom()
      const zoom = typeof rawZoom === "number" && !isNaN(rawZoom) ? rawZoom : 0
      // Adjust speed factor dynamically based on zoom level
      const speedFactor = 0.35 / Math.pow(2, zoom)

      // 2. Process and draw each particle
      particles.current.forEach((p) => {
        try {
          // If particle coordinate is invalid, respawn it immediately
          if (typeof p.lng !== "number" || typeof p.lat !== "number" || isNaN(p.lng) || isNaN(p.lat) || !isFinite(p.lng) || !isFinite(p.lat)) {
            const rx = Math.random() * w
            const ry = Math.random() * h
            const lngLat = map.unproject([rx, ry])
            if (lngLat && !isNaN(lngLat.lng) && !isNaN(lngLat.lat)) {
              p.lng = lngLat.lng
              p.lat = lngLat.lat
            } else {
              const center = map.getCenter()
              p.lng = center?.lng ?? 0
              p.lat = center?.lat ?? 0
            }
            p.age = 0
            p.life = Math.random() * 80 + 40
            p.prevX = null
            p.prevY = null
            return
          }

          // Project geographic coordinate to current screen pixels
          const pos = map.project([p.lng, p.lat])
          const x = pos?.x
          const y = pos?.y

          // Respawn if project returned invalid coordinates, out of bounds, or age exceeds life
          const isInvalidProject = typeof x !== "number" || typeof y !== "number" || isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)
          const isOffScreen = isInvalidProject || x < 0 || x > w || y < 0 || y > h
          
          if (isOffScreen || p.age >= p.life) {
            const rx = Math.random() * w
            const ry = Math.random() * h
            const lngLat = map.unproject([rx, ry])
            if (lngLat && !isNaN(lngLat.lng) && !isNaN(lngLat.lat)) {
              p.lng = lngLat.lng
              p.lat = lngLat.lat
            } else {
              const center = map.getCenter()
              p.lng = center?.lng ?? 0
              p.lat = center?.lat ?? 0
            }
            p.age = 0
            p.life = Math.random() * 80 + 40
            p.prevX = null
            p.prevY = null
            return
          }

          // Get wind vector (prefer real grid, fallback to mathematical flow)
          let u = 0
          let v = 0
          let realDataUsed = false

          // Only use grid if we are in a 'live' or 'syncing' status and grid is loaded
          if ((statusRef.current === "live" || statusRef.current === "syncing") && gridRef.current) {
            const vec = getGridWind(p.lng, p.lat, gridRef.current)
            if (vec) {
              u = vec[0]
              v = vec[1]
              realDataUsed = true
            }
          }

          if (!realDataUsed) {
            const vec = getMathWindVector(p.lng, p.lat, timestamp)
            u = vec[0]
            v = vec[1]
          }

          const windSpeed = Math.sqrt(u * u + v * v)

          // Draw particle line segment from prev frame screen position to current
          if (p.prevX !== null && p.prevY !== null) {
            ctx.beginPath()
            ctx.moveTo(p.prevX, p.prevY)
            ctx.lineTo(x, y)
            ctx.strokeStyle = getWindColor(windSpeed, "dark")
            ctx.lineWidth = windSpeed > 8 ? 1.5 : 1.0
            ctx.stroke()
          }

          p.prevX = x
          p.prevY = y

          // Update geographic location, compensating for Mercator longitude distortion near poles
          const rad = (p.lat * Math.PI) / 180
          const cosLat = Math.max(Math.cos(rad), 0.1)

          // Calibrate real m/s speeds vs the visual mathematical speed
          const speedScale = realDataUsed ? 1.6 : 1.0
          p.lng += (u * speedFactor * speedScale) / cosLat
          p.lat += v * speedFactor * speedScale
          p.age++
        } catch (err) {
          console.warn("Failed to update particle inside frame:", err)
          // Gracefully reset particle to recover
          const center = map.getCenter()
          p.lng = center?.lng ?? 0
          p.lat = center?.lat ?? 0
          p.prevX = null
          p.prevY = null
        }
      })

      animationFrameId = requestAnimationFrame(animate)
    }

    animationFrameId = requestAnimationFrame(animate)

    // Clear the canvas on pan/zoom so that old trails don't drift/smear
    const handleMapMove = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      particles.current.forEach((p) => {
        p.prevX = null
        p.prevY = null
      })
    }

    const handleMapResize = () => {
      resizeCanvas()
      handleMapMove()
    }

    // Debounce the weather API call so we don't request too frequently while actively panning
    let debounceTimer: number
    const handleMoveEnd = () => {
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        fetchWindData()
      }, 500)
    }

    map.on("move", handleMapMove)
    map.on("resize", handleMapResize)
    map.on("moveend", handleMoveEnd)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.clearTimeout(debounceTimer)
      if (abortControllerRef.current) abortControllerRef.current.abort()
      map.off("move", handleMapMove)
      map.off("resize", handleMapResize)
      map.off("moveend", handleMoveEnd)
    }
  }, [mapReady, theme, mapRef])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
        style={{ mixBlendMode: theme === "dark" ? "screen" : "multiply" }}
      />
      <div
        className={`absolute bottom-12 z-20 flex flex-col gap-1.5 transition-all duration-300 ease-in-out ${sidebarOpen ? "left-(--sidebar-width,16rem)" : "left-2"
          }`}
      >
        <div className="flex items-center gap-2 bg-background/60 backdrop-blur-xl px-4 py-1 rounded-full border border-white/10 border-t-white/20 border-l-white/20 shadow-lg text-[9px] font-semibold font-mono tracking-wide uppercase text-foreground/90">
          <span className={`h-1.5 w-1.5 rounded-full ${status === "syncing" ? "bg-amber-400 animate-pulse" :
            status === "ratelimit" ? "bg-orange-500 animate-pulse" :
              status === "offline" ? "bg-red-500" : "bg-emerald-400 animate-pulse"
            }`} />
          {status === "syncing" ? (
            <span>Syncing wind...</span>
          ) : status === "ratelimit" ? (
            <span>Rate Limited (Simulated)</span>
          ) : status === "offline" ? (
            <span>Wind Offline (Simulated)</span>
          ) : (
            <span>
              Real Wind: {speedRange ? `${speedRange.min.toFixed(1)} - ${speedRange.max.toFixed(1)} m/s` : "Loading..."}
            </span>
          )}
        </div>
      </div>
    </>
  )
}
