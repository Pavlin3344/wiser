import { useEffect, useState } from "react"
import { toast } from "sonner"

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS] = useState(() => {
    if (typeof window === "undefined") return false
    const userAgent = window.navigator.userAgent.toLowerCase()
    return /iphone|ipad|ipod/.test(userAgent)
  })

  const [isStandalone] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  })

  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  })

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Save the event so it can be triggered later
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setIsInstalled(true)
      console.log("PWA was installed successfully")
      toast.success("PWA was installed successfully")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const install = async () => {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      console.log(`User response to install prompt: ${outcome}`)
      toast(`PWA installation: ${outcome}`)
      if (outcome === "accepted") {
        setInstallPrompt(null)
      }
    } catch (err) {
      console.error("Installation prompt failed:", err)
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`PWA installation failed: ${msg}`)
    }
  }

  return { installPrompt, isInstalled, isIOS, isStandalone, install }
}
