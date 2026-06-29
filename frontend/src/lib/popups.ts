/** Escapes characters that are special in HTML to prevent XSS when
 *  injecting user/API-supplied strings into maplibregl `.setHTML()`. */
function escHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

export const generateGlassPopupHTML = (
  date: string,
  title: string,
  intensity: string,
  coordinates: number[],
  dotColor: string,
  textColor: string,
) => `
  <div class="font-sans max-w-56 p-4 rounded-2xl bg-background/60 backdrop-blur-xl shadow-lg border-white/10 border-t-white/20 border-l-white/20">
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

export const generateSectorPopupHTML = (
  sectorId: string,
  level: string,
  temp: number,
  humidity: number,
  dotColor: string,
  textColor: string,
) => `
  <div class="font-sans max-w-56 p-4 rounded-2xl bg-background/60 backdrop-blur-xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20">
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
