/** Converts a geographic coordinate (WGS84) to EPSG:3857 Web Mercator (meters). */
export function lngLatTo3857(lng: number, lat: number): [number, number] {
  const x = (lng * 20037508.34) / 180
  const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 180) / Math.PI
  return [x, (y * 20037508.34) / 180]
}
