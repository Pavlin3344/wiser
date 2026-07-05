import { Label } from "@/components/ui/label"

interface MapLegendProps {
  title: string
  type?: "fwi" | "viirs" | "fuel" | "settlement"
}

const FWI_LEVELS = [
  { label: "Low (< 11.2)", color: "#a0ffc3" },
  { label: "Moderate (11.2 - 21.3)", color: "#cfe355" },
  { label: "High (21.3 - 38.0)", color: "#e7af0a" },
  { label: "Very High (38.0 - 50.0)", color: "#dc7719" },
  { label: "Extreme (50.0 - 70.0)", color: "#b01117" },
  { label: "Very Extreme (> 70.0)", color: "#41091f" },
]

const VIIRS_LEVELS = [{ label: "Fire Season (VIIRS Suomi)", color: "#18c118" }]

const FUEL_LEVELS = [
  { label: "Short Grass", color: "#00ff55" },
  { label: "Grass & Understory", color: "#12ba37" },
  { label: "Tall Grass", color: "#0e7b15" },
  { label: "Chaparral", color: "#dede0e" },
  { label: "Brush", color: "#ffff00" },
  { label: "Dormant Brush", color: "#ffc000" },
  { label: "Southern Rough", color: "#ff6600" },
  { label: "Closed Timber Litter", color: "#c57e3f" },
  { label: "Hardwood Litter", color: "#963c00" },
  { label: "Timber & Understory", color: "#6d2828" },
]

const SETTLEMENT_LEVELS = [
  { label: "Built-up / Urban Area", color: "#7b4cd1" },
]

export function MapLegend({ title, type = "fwi" }: MapLegendProps & { type?: "fwi" | "viirs" | "fuel" | "settlement" }) {
  const levels = type === "fwi" ? FWI_LEVELS : type === "viirs" ? VIIRS_LEVELS : type === "fuel" ? FUEL_LEVELS : SETTLEMENT_LEVELS

  return (
    <div className='pointer-events-auto w-52'>
      <div className='bg-background/60 backdrop-blur-xl shadow-lg rounded-2xl border border-white/10 border-t-white/20 border-l-white/20 p-3 flex flex-col gap-2'>
        <div className='absolute inset-0 rounded-2xl bg-linear-to-br from-white/5 to-transparent pointer-events-none' />
        <Label className='text-[11px] uppercase tracking-wider text-muted-foreground font-bold'>{title}</Label>

        <div className='flex flex-col gap-1'>
          {levels.map((item) => (
            <div key={item.label} className='flex items-center gap-2'>
              <div className='size-3 rounded-full border border-white/20' style={{ backgroundColor: item.color }} />
              <span className='text-[11px] font-medium'>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
