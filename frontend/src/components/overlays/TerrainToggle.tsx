import { Mountain } from "lucide-react"
import { useMapStore } from "@/store/use-map-store"

export function TerrainToggle() {
  const { showTerrain, setShowTerrain } = useMapStore()

  return (
    <button
      onClick={() => setShowTerrain(!showTerrain)}
      className={`pointer-events-auto cursor-pointer flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all duration-300 shadow-md backdrop-blur-md border border-white/10 border-t-white/20 border-l-white/20 ${showTerrain ? "bg-primary/70 text-primary-foreground shadow-primary/20" : "bg-background/60 text-muted-foreground hover:bg-muted/80"}`}
    >
      <Mountain className={`size-4 ${showTerrain ? "text-primary-foreground" : "text-muted-foreground"}`} />
      <span>3D Terrain</span>
    </button>
  )
}
