import { create } from "zustand"
import { persist } from "zustand/middleware"

interface LayerState {
  showFires: boolean
  setShowFires: (show: boolean) => void

  showTerrain: boolean
  setShowTerrain: (show: boolean) => void

  showLabels: boolean
  setShowLabels: (show: boolean) => void

  /** Copernicus EFFIS fire weather raster - somebody else's model, shown as tiles. */
  showRiskGrid: boolean
  setShowRiskGrid: (show: boolean) => void

  /** Wiser's own risk zones: FWI corrected by NDVI and fuel type, computed here. */
  showRiskZones: boolean
  setShowRiskZones: (show: boolean) => void

  /**
   * Copernicus EFFIS VIIRS hotspot raster - an independent read of the same satellites
   * our own detections come from. It used to ride on `showFires`, which drew both it
   * and our points at once and made one fire look like two findings from two sources.
   *
   * There is deliberately no `showSmoke`: that toggle moved state nothing ever read,
   * because no smoke or aerosol layer exists to switch on.
   */
  showThermal: boolean
  setShowThermal: (show: boolean) => void

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

      showRiskZones: false,
      setShowRiskZones: (showRiskZones) => set({ showRiskZones }),

      showThermal: false,
      setShowThermal: (showThermal) => set({ showThermal }),

      showWind: false,
      setShowWind: (showWind) => set({ showWind }),

      showEvac: false,
      setShowEvac: (showEvac) => set({ showEvac }),

      showFuel: false,
      setShowFuel: (showFuel) => set({ showFuel }),

      showSettlement: false,
      setShowSettlement: (showSettlement) => set({ showSettlement }),
    }),
    {
      name: "wiser-layer-storage",
      // Bumped when showThermal stopped being an inert placeholder and started drawing
      // the EFFIS raster. Browsers holding the old default of `true` would otherwise
      // switch that layer on by themselves on first load after the deploy.
      version: 1,
    },
  ),
)
