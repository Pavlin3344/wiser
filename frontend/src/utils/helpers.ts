/** Stylizes fire intensity based on Fire Radiative Power (FRP) value. */
export function intensityStyle(frp: number) {
  if (frp > 50) return { dot: "bg-destructive", text: "text-destructive", label: "critical" }
  if (frp > 20) return { dot: "bg-orange-500", text: "text-orange-500", label: "high" }
  return { dot: "bg-amber-400", text: "text-amber-500", label: "moderate" }
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
