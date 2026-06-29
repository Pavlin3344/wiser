import { create } from "zustand"

export type RiskLevel = "Low" | "Moderate" | "High" | "Critical"

interface DataState {
  activeFireCount: number
  setActiveFireCount: (count: number) => void

  overallRiskLevel: RiskLevel
  setOverallRiskLevel: (level: RiskLevel) => void
}

/** Runtime-only store — derived from backend / mock data.
 *  Not persisted; values are always fetched fresh on mount. */
export const useDataStore = create<DataState>()((set) => ({
  activeFireCount: 12,
  setActiveFireCount: (activeFireCount) => set({ activeFireCount }),

  overallRiskLevel: "Moderate",
  setOverallRiskLevel: (overallRiskLevel) => set({ overallRiskLevel }),
}))
