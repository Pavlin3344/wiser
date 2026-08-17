/**
 * Air quality is sampled on a coarse grid over Bulgaria and stored as a time series,
 * so both endpoints can return nulls: a pollutant the upstream model did not publish
 * for that hour stays null rather than being reported as zero.
 */

/** Most recent reading for one grid point. Concentrations are µg/m³. */
export interface AirQualityReading {
  time: string
  lat: number
  lon: number
  source: string
  no2: number | null
  pm25: number | null
  pm10: number | null
  co: number | null
}

/** Country-wide average for one hour bucket. Concentrations are µg/m³. */
export interface AirQualityAverage {
  time: string
  no2: number | null
  pm25: number | null
  pm10: number | null
  co: number | null
}

/** Latest reading per sampling point, from the last 24 hours. */
export async function fetchLatestAirQuality(): Promise<AirQualityReading[]> {
  const res = await fetch("/api/v1/air-quality/latest")
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`)
  }
  return res.json() as Promise<AirQualityReading[]>
}

/** Hourly country-wide averages, for showing how pollution moved during a fire. */
export async function fetchAirQualityHistory(hours = 24): Promise<AirQualityAverage[]> {
  const res = await fetch(`/api/v1/air-quality/history?hours=${hours}`)
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`)
  }
  return res.json() as Promise<AirQualityAverage[]>
}
