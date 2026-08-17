import { escHtml } from "@/utils/helpers"

export const generateGlassPopupHTML = (
  date: string,
  title: string,
  intensity: string,
  coordinates: number[],
  dotColor: string,
  textColor: string,
) => `
  <div class="relative font-sans max-w-56 p-3 bg-background/60 backdrop-blur-xl shadow-lg rounded-2xl border-white/10 border-t-white/20 border-l-white/20">
    <div class='absolute inset-0 rounded-2xl bg-linear-to-br from-white/5 to-transparent pointer-events-none'></div>

    <div class="flex items-center justify-between mb-1.5">
      <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">${escHtml(date)}</div>
      <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/20 backdrop-blur-sm px-1.5 py-0.5 rounded-xl border border-border/10">EFFIS</div>
    </div>
    
    <div class="font-bold text-sm mb-2 text-foreground leading-tight">${escHtml(title)}</div>

    <div class="flex items-center gap-2 mb-3">
      <div class="w-2.5 h-2.5 rounded-full ${escHtml(dotColor)} border border-white/10 border-t-white/20 border-l-white/20 shadow-sm"></div>
      <span class="text-xs font-bold capitalize ${escHtml(textColor)}">${escHtml(intensity)} Risk</span>
    </div>

    <div class="text-xs text-muted-foreground border-t border-white/10 pt-2 mt-1">
      <div class="flex justify-between gap-4 mb-1">
        <span class="font-semibold text-foreground/70">Lat:</span>
        <span class="font-mono text-foreground">${coordinates[1].toFixed(4)}°</span>
      </div>
      <div class="flex justify-between gap-4">
        <span class="font-semibold text-foreground/70">Lon:</span>
        <span class="font-mono text-foreground">${coordinates[0].toFixed(4)}°</span>
      </div>
    </div>
  </div>
`

const RISK_CLASS_LABELS = ["", "Low", "Moderate", "High", "Very High", "Extreme", "Very Extreme"]
const RISK_CLASS_COLORS = ["", "#a0ffc3", "#cfe355", "#e7af0a", "#dc7719", "#b01117", "#41091f"]

/**
 * Breakdown of one Wiser risk cell.
 *
 * Shows the inputs next to the result rather than only the final class: the whole
 * point of running our own model beside EFFIS is being able to say why the two
 * disagree. A missing input reads as a dash, never as a zero measurement.
 */
export const generateRiskZonePopupHTML = (zone: {
  riskClass: number
  fwiClass: number
  fwiValue: number | null
  ndviMean: number | null
  fuelType: number | null
  validDate: string
}) => {
  const label = RISK_CLASS_LABELS[zone.riskClass] ?? "Unknown"
  const color = RISK_CLASS_COLORS[zone.riskClass] ?? "#a0ffc3"
  const num = (value: number | null, digits: number) =>
    typeof value === "number" ? value.toFixed(digits) : "—"

  const row = (name: string, value: string) => `
      <div class="flex justify-between gap-4">
        <span class="font-semibold text-foreground/70">${escHtml(name)}</span>
        <span class="font-mono text-foreground">${escHtml(value)}</span>
      </div>`

  return `
  <div class="relative font-sans max-w-60 p-3 bg-background/60 backdrop-blur-xl shadow-lg rounded-2xl border border-white/10 border-t-white/20 border-l-white/20">
    <div class='absolute inset-0 rounded-2xl bg-linear-to-br from-white/5 to-transparent pointer-events-none'></div>

    <div class="flex items-center justify-between mb-1.5">
      <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">${escHtml(zone.validDate)}</div>
      <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/20 backdrop-blur-sm px-1.5 py-0.5 rounded-xl border border-border/10">WISER</div>
    </div>

    <div class="flex items-center gap-2 mb-3">
      <div class="w-2.5 h-2.5 rounded-full border border-white/20" style="background-color: ${escHtml(color)}"></div>
      <span class="font-bold text-sm text-foreground leading-tight">${escHtml(label)}</span>
      <span class="ml-auto text-[10px] font-mono text-muted-foreground">class ${zone.riskClass}/6</span>
    </div>

    <div class="text-xs text-muted-foreground border-t border-white/10 pt-2 space-y-1">
      ${row("FWI", `${num(zone.fwiValue, 1)} (class ${zone.fwiClass})`)}
      ${row("NDVI", num(zone.ndviMean, 2))}
      ${row("Fuel (NFFL)", zone.fuelType === null ? "—" : String(zone.fuelType))}
    </div>
  </div>
`
}

export const generateSectorPopupHTML = (
  sectorId: string,
  level: string,
  temp: number,
  humidity: number,
  dotColor: string,
  textColor: string,
) => `
  <div class="relative font-sans max-w-56 p-3 bg-background/60 backdrop-blur-xl shadow-lg rounded-2xl border border-white/10 border-t-white/20 border-l-white/20">
    <div class='absolute inset-0 rounded-2xl bg-linear-to-br from-white/5 to-transparent pointer-events-none'></div>

    <div class="flex items-center justify-between mb-1.5">
      <div class="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">${escHtml(sectorId)}</div>
      <div class="w-2 h-2 rounded-full ${escHtml(dotColor)} animate-pulse shadow-[0_0_8px_rgba(0,0,0,0.5)]"></div>
    </div>
    
    <div class="font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 ${escHtml(textColor)}">
      Sector Status: ${escHtml(level)}
    </div>

    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="bg-background/50 rounded-lg p-2 border border-white/10 flex flex-col justify-center items-center">
        <span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Surface</span>
        <span class="font-mono font-bold text-foreground text-xs">${temp}°C</span>
      </div>
      <div class="bg-background/50 rounded-lg p-2 border border-white/10 flex flex-col justify-center items-center">
        <span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Humidity</span>
        <span class="font-mono font-bold text-foreground text-xs">${humidity}%</span>
      </div>
    </div>
  </div>
`
