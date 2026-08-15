import { create } from "zustand"
import type { RiskLevel } from "@/types/types"

interface DataState {
  activeFireCount: number
  setActiveFireCount: (count: number) => void

  overallRiskLevel: RiskLevel
  setOverallRiskLevel: (level: RiskLevel) => void
}

/** Runtime-only store — derived from backend data.
 *  Not persisted; values are always fetched fresh on mount. */
export const useDataStore = create<DataState>()((set) => ({
  // Starts at zero: any other number would be a count of fires nobody detected.
  activeFireCount: 0,
  setActiveFireCount: (activeFireCount) => set({ activeFireCount }),

  overallRiskLevel: "Moderate",
  setOverallRiskLevel: (overallRiskLevel) => set({ overallRiskLevel }),
}))
