import { create } from "zustand"
import { persist } from "zustand/middleware"

interface FilterState {
  region: string
  setRegion: (region: string) => void

  riskLevel: string
  setRiskLevel: (level: string) => void

  selectedDate: string
  setSelectedDate: (date: string) => void

  /** 0–23 representing the current playback hour */
  currentTime: number
  setCurrentTime: (time: number) => void

  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void

  /** Detection filters. Applied to the live feed before it reaches the map. */
  minConfidence: number
  setMinConfidence: (value: number) => void

  /** FIRMS instruments to include, matched against a detection's `source`. */
  enabledSensors: string[]
  toggleSensor: (source: string, enabled: boolean) => void

  /** Whether the map subscribes to live pushes or only loads once. */
  liveUpdates: boolean
  setLiveUpdates: (on: boolean) => void
}

export const SENSOR_MODIS = "MODIS_NRT"
export const SENSOR_VIIRS = "VIIRS_SNPP_NRT"

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      region: "bulgaria",
      setRegion: (region) => set({ region }),

      riskLevel: "all",
      setRiskLevel: (riskLevel) => set({ riskLevel }),

      selectedDate: new Date().toISOString(),
      setSelectedDate: (selectedDate) => set({ selectedDate }),

      currentTime: 0,
      setCurrentTime: (currentTime) => set({ currentTime }),

      isPlaying: false,
      setIsPlaying: (isPlaying) => set({ isPlaying }),

      minConfidence: 0,
      setMinConfidence: (minConfidence) => set({ minConfidence }),

      enabledSensors: [SENSOR_MODIS, SENSOR_VIIRS],
      toggleSensor: (source, enabled) =>
        set((state) => ({
          enabledSensors: enabled
            ? Array.from(new Set([...state.enabledSensors, source]))
            : state.enabledSensors.filter((s) => s !== source),
        })),

      liveUpdates: true,
      setLiveUpdates: (liveUpdates) => set({ liveUpdates }),
    }),
    {
      name: "wiser-filter-storage",
      // Do not persist transient playback state across sessions
      partialize: (state) => ({
        region: state.region,
        riskLevel: state.riskLevel,
        selectedDate: state.selectedDate,
        minConfidence: state.minConfidence,
        enabledSensors: state.enabledSensors,
        liveUpdates: state.liveUpdates,
      }),
    },
  ),
)
