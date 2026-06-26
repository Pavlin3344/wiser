import { Moon, Sun } from "lucide-react"
import { useMapStore } from "@/store/use-map-store"

export function ThemeToggle() {
  const { theme, setTheme } = useMapStore()

  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className='p-2 rounded-full bg-background/60 backdrop-blur-md border border-white/10 shadow-lg hover:bg-white/10 transition-colors'>
      {theme === "dark" ? <Sun className='w-5 h-5 text-yellow-400' /> : <Moon className='w-5 h-5 text-slate-700' />}
    </button>
  )
}
