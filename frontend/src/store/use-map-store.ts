import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { Theme } from "@/types/types"

interface SerializedDateRange {
  from: string | undefined
  to: string | undefined
}

interface MapState {
  theme: Theme
  setTheme: (theme: Theme) => void

  currentTime: number
  setCurrentTime: (time: number) => void

  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void

  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  activeSidebarTab: "risk" | "detection" | "analysis" | "alerts"
  setActiveSidebarTab: (tab: "risk" | "detection" | "analysis" | "alerts") => void

  camera: { lng: number; lat: number; zoom: number; pitch: number; bearing: number }
  setCamera: (camera: { lng: number; lat: number; zoom: number; pitch: number; bearing: number }) => void

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

  region: string
  setRegion: (region: string) => void
  showRiskGrid: boolean
  setShowRiskGrid: (show: boolean) => void
  riskLevel: string
  setRiskLevel: (level: string) => void
  showThermal: boolean
  setShowThermal: (show: boolean) => void
  showSmoke: boolean
  setShowSmoke: (show: boolean) => void
  showWind: boolean
  setShowWind: (show: boolean) => void
  showEvac: boolean
  setShowEvac: (show: boolean) => void

  dateRange: SerializedDateRange
  setDateRange: (range: SerializedDateRange) => void
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),

      currentTime: 0,
      setCurrentTime: (time) => set({ currentTime: time }),

      isPlaying: false,
      setIsPlaying: (playing) => set({ isPlaying: playing }),

      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      activeSidebarTab: "risk",
      setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

      camera: { lng: 25.5, lat: 42.0, zoom: 7, pitch: 0, bearing: 0 },
      setCamera: (camera) => set({ camera }),

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

      region: "all",
      setRegion: (region) => set({ region }),
      showRiskGrid: true,
      setShowRiskGrid: (show) => set({ showRiskGrid: show }),
      riskLevel: "all",
      setRiskLevel: (level) => set({ riskLevel: level }),
      showThermal: true,
      setShowThermal: (show) => set({ showThermal: show }),
      showSmoke: true,
      setShowSmoke: (show) => set({ showSmoke: show }),
      showWind: false,
      setShowWind: (show) => set({ showWind: show }),
      showEvac: false,
      setShowEvac: (show) => set({ showEvac: show }),

      dateRange: { from: new Date().toISOString(), to: new Date().toISOString() },
      setDateRange: (range) => set({ dateRange: range }),
    }),
    {
      name: "wiser-system-storage",
      partialize: (state) => ({
        theme: state.theme,
        currentTime: state.currentTime,
        isPlaying: state.isPlaying,
        sidebarOpen: state.sidebarOpen,
        activeSidebarTab: state.activeSidebarTab,
        camera: state.camera,
        mapView: state.mapView,
        basemap: state.basemap,
        showFires: state.showFires,
        showTerrain: state.showTerrain,
        showLabels: state.showLabels,
        region: state.region,
        showRiskGrid: state.showRiskGrid,
        riskLevel: state.riskLevel,
        showThermal: state.showThermal,
        showSmoke: state.showSmoke,
        showWind: state.showWind,
        showEvac: state.showEvac,
        dateRange: state.dateRange,
      }),
    },
  ),
)
