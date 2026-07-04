import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Theme, SidebarTab } from "@/types/types"

interface UIState {
  theme: Theme
  setTheme: (theme: Theme) => void

  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  activeSidebarTab: SidebarTab
  setActiveSidebarTab: (tab: SidebarTab) => void

  secondaryBarOpen: boolean
  setSecondaryBarOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),

      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      activeSidebarTab: "risk",
      setActiveSidebarTab: (activeSidebarTab) => set({ activeSidebarTab }),

      secondaryBarOpen: true,
      setSecondaryBarOpen: (secondaryBarOpen) => set({ secondaryBarOpen }),
    }),
    { name: "wiser-ui-storage" },
  ),
)
