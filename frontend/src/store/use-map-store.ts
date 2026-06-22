import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { DateRange } from "react-day-picker"

interface MapState {
  activeSidebarTab: "risk" | "detection" | "analysis" | "alerts"
  setActiveSidebarTab: (tab: "risk" | "detection" | "analysis" | "alerts") => void

  mapView: "2d" | "3d"
  setMapView: (view: "2d" | "3d") => void
  basemap: "topographic" | "satellite"
  setBasemap: (map: "topographic" | "satellite") => void

  showFires: boolean
  setShowFires: (show: boolean) => void

  showTerrain: boolean
  setShowTerrain: (show: boolean) => void

  showLabels: boolean
  setShowLabels: (show: boolean) => void

  dateRange: DateRange | undefined
  setDateRange: (range: DateRange | undefined) => void
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      activeSidebarTab: "risk",
      setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

      mapView: "2d",
      setMapView: (view) => set({ mapView: view }),

      basemap: "topographic",
      setBasemap: (map) => set({ basemap: map }),

      showFires: false,
      setShowFires: (show) => set({ showFires: show }),

      showTerrain: false,
      setShowTerrain: (show) => set({ showTerrain: show }),

      showLabels: false,
      setShowLabels: (show) => set({ showLabels: show }),

      dateRange: { from: new Date(), to: new Date() },
      setDateRange: (range) => set({ dateRange: range }),
    }),
    {
      name: "wiser-system-storage",
      partialize: (state) => ({
        activeSidebarTab: state.activeSidebarTab,
        mapView: state.mapView,
        basemap: state.basemap,
        showFires: state.showFires,
        showTerrain: state.showTerrain,
        showLabels: state.showLabels,
      }),
    },
  ),
)
