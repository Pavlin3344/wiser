import { create } from "zustand"
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
  dateRange: DateRange | undefined
  setDateRange: (range: DateRange | undefined) => void
}

export const useMapStore = create<MapState>((set) => ({
  activeSidebarTab: "risk",
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

  mapView: "2d",
  setMapView: (view) => set({ mapView: view }),
  basemap: "topographic",
  setBasemap: (map) => set({ basemap: map }),

  showFires: false,
  setShowFires: (show) => set({ showFires: show }),
  dateRange: { from: new Date(), to: new Date() },
  setDateRange: (range) => set({ dateRange: range }),
}))
