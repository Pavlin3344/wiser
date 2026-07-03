import type { FeatureCollection } from "geojson"

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

interface EffisFeatureInfoParams {
  layer: string
  bbox: string
  width: number
  height: number
  x: number
  y: number
}

/**
 * Queries the EFFIS WMS service for detailed info about a specific map pixel location.
 */
export async function fetchEffisWmsFeatureInfo(params: EffisFeatureInfoParams): Promise<string> {
  const url =
    `/effis-wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo` +
    `&LAYERS=${params.layer}&QUERY_LAYERS=${params.layer}` +
    `&BBOX=${params.bbox}&WIDTH=${params.width}&HEIGHT=${params.height}` +
    `&SRS=EPSG:3857&X=${params.x}&Y=${params.y}` +
    `&STYLES=&INFO_FORMAT=text/plain`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`)
  }
  return res.text()
}
