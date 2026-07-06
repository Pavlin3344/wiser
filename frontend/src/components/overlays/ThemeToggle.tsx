import { Moon, Sun } from "lucide-react"

import { useUIStore } from "@/store/use-ui-store"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function ThemeToggle() {
  const { theme, setTheme } = useUIStore()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className='hidden sm:block pointer-events-auto p-2 rounded-full bg-background/60 backdrop-blur-xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20 hover:bg-muted/80 transition-colors cursor-pointer'>
          {theme === "dark" ? <Sun className='w-5 h-5 text-yellow-400' /> : <Moon className='w-5 h-5' />}
        </button>
      </TooltipTrigger>
      <TooltipContent side='left' sideOffset={8}>
        {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      </TooltipContent>
    </Tooltip>
  )
}
