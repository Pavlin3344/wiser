import { create } from "zustand"
import { persist } from "zustand/middleware"

interface LayerState {
  showFires: boolean
  setShowFires: (show: boolean) => void

  showTerrain: boolean
  setShowTerrain: (show: boolean) => void

  showLabels: boolean
  setShowLabels: (show: boolean) => void

  showRiskGrid: boolean
  setShowRiskGrid: (show: boolean) => void

  /** Placeholder — layer not yet implemented; toggle is reserved for a future
   *  Sentinel-3 smoke/aerosol layer. Wired to the UI but has no map layer. */
  showThermal: boolean
  setShowThermal: (show: boolean) => void

  /** Placeholder — layer not yet implemented; toggle is reserved for a future
   *  Sentinel-3 smoke/aerosol layer. Wired to the UI but has no map layer. */
  showSmoke: boolean
  setShowSmoke: (show: boolean) => void

  /** Placeholder — wind particle layer under active development (feature/wind).
   *  Toggle exists in the store so the branch can enable it without a store change. */
  showWind: boolean
  setShowWind: (show: boolean) => void

  showEvac: boolean
  setShowEvac: (show: boolean) => void

  showFuel: boolean
  setShowFuel: (show: boolean) => void

  showSettlement: boolean
  setShowSettlement: (show: boolean) => void
}

export const useLayerStore = create<LayerState>()(
  persist(
    (set) => ({
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

      showFuel: false,
      setShowFuel: (showFuel) => set({ showFuel }),

      showSettlement: false,
      setShowSettlement: (showSettlement) => set({ showSettlement }),
    }),
    { name: "wiser-layer-storage" },
  ),
)
