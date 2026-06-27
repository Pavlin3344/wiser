import { create } from "zustand"
import { persist, subscribeWithSelector } from "zustand/middleware"

import type { Theme } from "@/types/types"

export interface Camera {
  lng: number
  lat: number
  zoom: number
  pitch: number
  bearing: number
}

/** High-frequency map UI state — updated every mousemove / zoom.
 *  Subscribers read this directly via useMapStore.subscribe() to avoid
 *  re-rendering the entire React tree on every pointer event. */
export interface MapStatus {
  lat: number
  lng: number
  zoom: number
  elevation: number
  bearing: number
}

type SidebarTab = "risk" | "detection" | "analysis" | "alerts"
export type RiskLevel = "Low" | "Moderate" | "High" | "Critical"

interface MapState {
  theme: Theme
  setTheme: (theme: Theme) => void

  currentTime: number
  setCurrentTime: (time: number) => void
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void

  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  activeSidebarTab: SidebarTab
  setActiveSidebarTab: (tab: SidebarTab) => void

  camera: Camera
  setCamera: (camera: Camera) => void

  flyToTarget: { lat: number; lng: number; zoom: number } | null
  setFlyToTarget: (target: { lat: number; lng: number; zoom: number } | null) => void

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
  showRiskGrid: boolean
  setShowRiskGrid: (show: boolean) => void
  showThermal: boolean
  setShowThermal: (show: boolean) => void
  showSmoke: boolean
  setShowSmoke: (show: boolean) => void
  showWind: boolean
  setShowWind: (show: boolean) => void
  showEvac: boolean
  setShowEvac: (show: boolean) => void

  region: string
  setRegion: (region: string) => void
  riskLevel: string
  setRiskLevel: (level: string) => void
  selectedDate: string
  setSelectedDate: (date: string) => void

  /** Updated every mousemove/zoom — consume via useMapStore.subscribe(),
   *  NOT via useMapStore() hook, to avoid re-renders. */
  mapStatus: MapStatus
  setMapStatus: (status: Partial<MapStatus>) => void

  activeFireCount: number
  setActiveFireCount: (count: number) => void

  overallRiskLevel: RiskLevel
  setOverallRiskLevel: (level: RiskLevel) => void
}

export const useMapStore = create<MapState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        theme: "light",
        setTheme: (theme) => set({ theme }),

        currentTime: 0,
        setCurrentTime: (currentTime) => set({ currentTime }),
        isPlaying: false,
        setIsPlaying: (isPlaying) => set({ isPlaying }),

        sidebarOpen: true,
        setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
        activeSidebarTab: "risk",
        setActiveSidebarTab: (activeSidebarTab) => set({ activeSidebarTab }),

        camera: { lng: 25.5, lat: 42.0, zoom: 7, pitch: 0, bearing: 0 },
        setCamera: (camera) => set({ camera }),

        flyToTarget: null,
        setFlyToTarget: (flyToTarget) => set({ flyToTarget }),

        mapView: "2d",
        setMapView: (mapView) => set({ mapView }),
        basemap: "topographic",
        setBasemap: (basemap) => set({ basemap }),

        showFires: false,
        setShowFires: (showFires) => set({ showFires }),
        showTerrain: false,
        setShowTerrain: (showTerrain) => set({ showTerrain }),
        showLabels: false,
        setShowLabels: (showLabels) => set({ showLabels }),
        showRiskGrid: true,
        setShowRiskGrid: (showRiskGrid) => set({ showRiskGrid }),
        showThermal: true,
        setShowThermal: (showThermal) => set({ showThermal }),
        showSmoke: true,
        setShowSmoke: (showSmoke) => set({ showSmoke }),
        showWind: false,
        setShowWind: (showWind) => set({ showWind }),
        showEvac: false,
        setShowEvac: (showEvac) => set({ showEvac }),

        region: "all",
        setRegion: (region) => set({ region }),
        riskLevel: "all",
        setRiskLevel: (riskLevel) => set({ riskLevel }),
        selectedDate: new Date().toISOString(),
        setSelectedDate: (selectedDate) => set({ selectedDate }),

        mapStatus: { lat: 42.0, lng: 25.5, zoom: 7, elevation: 0, bearing: 0 },
        setMapStatus: (partial) => set((s) => ({ mapStatus: { ...s.mapStatus, ...partial } })),

        activeFireCount: 12,
        setActiveFireCount: (activeFireCount) => set({ activeFireCount }),

        overallRiskLevel: "Moderate",
        setOverallRiskLevel: (overallRiskLevel) => set({ overallRiskLevel }),
      }),
      {
        name: "wiser-system-storage",
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        partialize: ({ mapStatus, currentTime, isPlaying, activeFireCount, overallRiskLevel, flyToTarget, ...rest }) => rest,
      },
    ),
  ),
)
