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
}

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
    }),
    {
      name: "wiser-filter-storage",
      // Do not persist transient playback state across sessions
      partialize: ({ currentTime, isPlaying, ...rest }) => rest,
    },
  ),
)
