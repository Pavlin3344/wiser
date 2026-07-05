import { Moon, Sun } from "lucide-react"

import { useUIStore } from "@/store/use-ui-store"

export function ThemeToggle() {
  const { theme, setTheme } = useUIStore()

  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className='hidden sm:block pointer-events-auto p-2 rounded-full bg-background/60 backdrop-blur-xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20 hover:bg-muted/80 transition-colors cursor-pointer'>
      {theme === "dark" ? <Sun className='w-5 h-5 text-yellow-400' /> : <Moon className='w-5 h-5' />}
    </button>
  )
}
