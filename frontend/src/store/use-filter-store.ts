import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * There is deliberately no `region` here. The system is scoped to Bulgaria: every
 * data layer clips to the national border, so a selectable region would only ever
 * mean "also download and draw data nobody is monitoring".
 */
interface FilterState {
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
      // Bumped when `region` was dropped: browsers that stored region:"europe" would
      // otherwise keep merging it back in, and the value outlived the code reading it.
      version: 1,
      // Do not persist transient playback state across sessions
      partialize: (state) => ({
        riskLevel: state.riskLevel,
        selectedDate: state.selectedDate,
        minConfidence: state.minConfidence,
        enabledSensors: state.enabledSensors,
        liveUpdates: state.liveUpdates,
      }),
    },
  ),
)
