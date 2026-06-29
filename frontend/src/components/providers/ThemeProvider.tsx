import { useEffect } from "react"
import { useUIStore } from "@/store/use-ui-store"

interface ThemeProviderProps {
  children: React.ReactNode
}

function applyTheme(theme: string) {
  const root = window.document.documentElement
  root.classList.remove("light", "dark")

  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    root.classList.add(systemTheme)
    return
  }

  root.classList.add(theme)
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme } = useUIStore()

  useEffect(() => {
    applyTheme(theme)

    if (theme !== "system") return

    // When the user has selected "system", stay in sync with OS preference changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onOsChange = () => applyTheme("system")
    mq.addEventListener("change", onOsChange)
    return () => mq.removeEventListener("change", onOsChange)
  }, [theme])

  return <>{children}</>
}
