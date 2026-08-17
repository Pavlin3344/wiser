/** Stylizes fire intensity based on Fire Radiative Power (FRP) value. */
export function intensityStyle(frp: number) {
  if (frp > 50) return { dot: "bg-destructive", text: "text-destructive", label: "critical" }
  if (frp > 20) return { dot: "bg-orange-500", text: "text-orange-500", label: "high" }
  return { dot: "bg-amber-400", text: "text-amber-500", label: "moderate" }
}

/**
 * Upper bounds of the first five European Air Quality Index bands, in µg/m³
 * (European Environment Agency). Carbon monoxide is deliberately absent: the
 * index defines no breakpoints for it, so a CO reading gets no band rather
 * than an invented one.
 */
const EAQI_LIMITS = {
  pm25: [10, 20, 25, 50, 75],
  pm10: [20, 40, 50, 100, 150],
  no2: [40, 90, 120, 230, 340],
} as const

export type EAQIPollutant = keyof typeof EAQI_LIMITS

/** Band styling, indexed by level - 1. Colours follow the official EAQI palette. */
const EAQI_BANDS = [
  { label: "Good", text: "text-cyan-400", border: "border-cyan-400/40", bg: "bg-cyan-400/10" },
  { label: "Fair", text: "text-emerald-400", border: "border-emerald-400/40", bg: "bg-emerald-400/10" },
  { label: "Moderate", text: "text-amber-400", border: "border-amber-400/40", bg: "bg-amber-400/10" },
  { label: "Poor", text: "text-orange-500", border: "border-orange-500/40", bg: "bg-orange-500/10" },
  { label: "Very poor", text: "text-red-500", border: "border-red-500/40", bg: "bg-red-500/10" },
  { label: "Extremely poor", text: "text-purple-400", border: "border-purple-400/40", bg: "bg-purple-400/10" },
] as const

export type EAQIBand = (typeof EAQI_BANDS)[number] & { level: number }

/**
 * Classifies one pollutant concentration into its EAQI band. Returns null for a
 * missing reading so the caller can show "no data" instead of a colour that would
 * read as a measurement.
 */
export function eaqiBand(pollutant: EAQIPollutant, value: number | null | undefined): EAQIBand | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  const index = EAQI_LIMITS[pollutant].findIndex((limit) => value < limit)
  const level = index === -1 ? EAQI_BANDS.length : index + 1
  return { ...EAQI_BANDS[level - 1], level }
}

/** Escapes characters that are special in HTML to prevent XSS when
 *  injecting user/API-supplied strings into maplibregl `.setHTML()`. */
export function escHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}
