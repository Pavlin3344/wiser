import type { FeatureCollection } from "geojson"

/** Server-Sent Events endpoint pushing active fire updates as they are ingested. */
export const FIRE_STREAM_URL = "/api/v1/fires/stream"

/**
 * Fetches real active fire data from the backend.
 */
export async function fetchActiveFires(): Promise<FeatureCollection> {
  const r = await fetch("/api/v1/fires/active")
  if (!r.ok) {
    throw new Error(`HTTP error ${r.status}`)
  }
  return r.json() as Promise<FeatureCollection>
}

export interface Alert {
  id: number
  fireId: number | null
  alertType: string
  severity: string
  targetType: string | null
  targetId: number | null
  message: string | null
  sentAt: string
}

interface Page<T> {
  content: T[]
}

/** Proximity alerts raised by the alerts service. */
export async function fetchAlerts(): Promise<Alert[]> {
  const res = await fetch("/api/alerts?size=50&sort=sentAt,desc")
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`)
  }
  const page = (await res.json()) as Page<Alert>
  return page.content ?? []
}

export interface DailyFireCount {
  day: string
  count: number
}

/** Detections per day for the trends chart. */
export async function fetchDailyFireCounts(days = 7): Promise<DailyFireCount[]> {
  const res = await fetch(`/api/v1/fires/daily-counts?days=${days}`)
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`)
  }
  return res.json() as Promise<DailyFireCount[]>
}

interface EffisFeatureInfoParams {
  layer: string
  bbox: string
  width: number
  height: number
  x: number
  y: number
  /** YYYY-MM-DD. The hotspot layer is time-dimensioned and defaults to 2020-01-01
   *  when this is omitted, so a query without it asks about the wrong day. */
  time: string
}

/**
 * Queries the EFFIS WMS service for detailed info about a specific map pixel location.
 */
export async function fetchEffisWmsFeatureInfo(params: EffisFeatureInfoParams): Promise<string> {
  const url =
    `/effis-wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo` +
    `&LAYERS=${params.layer}&QUERY_LAYERS=${params.layer}&TIME=${params.time}` +
    `&BBOX=${params.bbox}&WIDTH=${params.width}&HEIGHT=${params.height}` +
    `&SRS=EPSG:3857&X=${params.x}&Y=${params.y}` +
    `&STYLES=&INFO_FORMAT=text/plain`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`)
  }
  return res.text()
}
