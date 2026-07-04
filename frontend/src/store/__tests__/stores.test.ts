import { describe, it, expect, beforeEach } from "vitest"
import { useDataStore } from "@/store/use-data-store"
import { useFilterStore } from "@/store/use-filter-store"
import { useLayerStore } from "@/store/use-layer-store"
import { useMapStore } from "@/store/use-map-store"
import { useUIStore } from "@/store/use-ui-store"

describe("Zustand global stores", () => {
  describe("useDataStore", () => {
    beforeEach(() => {
      // Reset store to initial values
      useDataStore.setState({
        activeFireCount: 12,
        overallRiskLevel: "Moderate",
      })
    })

    it("should have correct initial values", () => {
      const state = useDataStore.getState()
      expect(state.activeFireCount).toBe(12)
      expect(state.overallRiskLevel).toBe("Moderate")
    })

    it("should update activeFireCount", () => {
      useDataStore.getState().setActiveFireCount(25)
      expect(useDataStore.getState().activeFireCount).toBe(25)
    })

    it("should update overallRiskLevel", () => {
      useDataStore.getState().setOverallRiskLevel("Critical")
      expect(useDataStore.getState().overallRiskLevel).toBe("Critical")
    })
  })

  describe("useFilterStore", () => {
    beforeEach(() => {
      useFilterStore.setState({
        region: "bulgaria",
        riskLevel: "all",
        selectedDate: "2026-07-04T00:00:00.000Z",
        currentTime: 0,
        isPlaying: false,
      })
    })

    it("should have correct initial values", () => {
      const state = useFilterStore.getState()
      expect(state.region).toBe("bulgaria")
      expect(state.riskLevel).toBe("all")
      expect(state.currentTime).toBe(0)
      expect(state.isPlaying).toBe(false)
    })

    it("should update region", () => {
      useFilterStore.getState().setRegion("sofia")
      expect(useFilterStore.getState().region).toBe("sofia")
    })

    it("should update riskLevel", () => {
      useFilterStore.getState().setRiskLevel("high")
      expect(useFilterStore.getState().riskLevel).toBe("high")
    })

    it("should update selectedDate", () => {
      useFilterStore.getState().setSelectedDate("2026-08-01T12:00:00.000Z")
      expect(useFilterStore.getState().selectedDate).toBe("2026-08-01T12:00:00.000Z")
    })

    it("should update currentTime", () => {
      useFilterStore.getState().setCurrentTime(14)
      expect(useFilterStore.getState().currentTime).toBe(14)
    })

    it("should update isPlaying", () => {
      useFilterStore.getState().setIsPlaying(true)
      expect(useFilterStore.getState().isPlaying).toBe(true)
    })

    it("should partialize store state correctly for persistence", () => {
      const partialize = useFilterStore.persist.getOptions().partialize
      if (partialize) {
        const fullState = {
          region: "varna",
          riskLevel: "medium",
          selectedDate: "2026-07-04T00:00:00.000Z",
          currentTime: 10,
          isPlaying: true,
          setRegion: () => {},
          setRiskLevel: () => {},
          setSelectedDate: () => {},
          setCurrentTime: () => {},
          setIsPlaying: () => {},
        }
        const partial = partialize(fullState)
        expect(partial).toEqual(expect.objectContaining({
          region: "varna",
          riskLevel: "medium",
          selectedDate: "2026-07-04T00:00:00.000Z",
        }))
        expect((partial as any).currentTime).toBeUndefined()
        expect((partial as any).isPlaying).toBeUndefined()
      } else {
        throw new Error("partialize function is not defined on useFilterStore")
      }
    })
  })

  describe("useLayerStore", () => {
    beforeEach(() => {
      useLayerStore.setState({
        showFires: false,
        showTerrain: false,
        showLabels: false,
        showRiskGrid: true,
        showThermal: true,
        showSmoke: true,
        showWind: false,
        showEvac: false,
      })
    })

    it("should have correct initial values", () => {
      const state = useLayerStore.getState()
      expect(state.showFires).toBe(false)
      expect(state.showTerrain).toBe(false)
      expect(state.showRiskGrid).toBe(true)
      expect(state.showThermal).toBe(true)
      expect(state.showWind).toBe(false)
    })

    it("should support toggling each layer", () => {
      const store = useLayerStore.getState()
      store.setShowFires(true)
      store.setShowTerrain(true)
      store.setShowLabels(true)
      store.setShowRiskGrid(false)
      store.setShowThermal(false)
      store.setShowSmoke(false)
      store.setShowWind(true)
      store.setShowEvac(true)

      const state = useLayerStore.getState()
      expect(state.showFires).toBe(true)
      expect(state.showTerrain).toBe(true)
      expect(state.showLabels).toBe(true)
      expect(state.showRiskGrid).toBe(false)
      expect(state.showThermal).toBe(false)
      expect(state.showSmoke).toBe(false)
      expect(state.showWind).toBe(true)
      expect(state.showEvac).toBe(true)
    })
  })

  describe("useMapStore", () => {
    beforeEach(() => {
      useMapStore.setState({
        camera: { lng: 25.5, lat: 42.0, zoom: 7, pitch: 0, bearing: 0 },
        flyToTarget: null,
        mapView: "2d",
        basemap: "topographic",
        mapStatus: { lat: 42.0, lng: 25.5, zoom: 7, elevation: 0, bearing: 0 },
        mapInstance: null,
        userLocation: null,
      })
    })

    it("should have correct initial values", () => {
      const state = useMapStore.getState()
      expect(state.camera).toEqual({ lng: 25.5, lat: 42.0, zoom: 7, pitch: 0, bearing: 0 })
      expect(state.flyToTarget).toBeNull()
      expect(state.mapView).toBe("2d")
      expect(state.basemap).toBe("topographic")
      expect(state.mapInstance).toBeNull()
      expect(state.userLocation).toBeNull()
    })

    it("should update camera, flyToTarget, mapView, basemap, mapInstance, userLocation", () => {
      const store = useMapStore.getState()
      const newCamera = { lng: 23.3, lat: 42.7, zoom: 10, pitch: 15, bearing: 45 }
      const newTarget = { lat: 42.1, lng: 24.5, zoom: 12 }
      const mockMapInstance = { getZoom: () => 10 } as any
      const mockUserLocation = { lat: 42.6, lng: 23.3 }

      store.setCamera(newCamera)
      store.setFlyToTarget(newTarget)
      store.setMapView("3d")
      store.setBasemap("satellite")
      store.setMapInstance(mockMapInstance)
      store.setUserLocation(mockUserLocation)

      const state = useMapStore.getState()
      expect(state.camera).toEqual(newCamera)
      expect(state.flyToTarget).toEqual(newTarget)
      expect(state.mapView).toBe("3d")
      expect(state.basemap).toBe("satellite")
      expect(state.mapInstance).toBe(mockMapInstance)
      expect(state.userLocation).toEqual(mockUserLocation)
    })

    it("should partially update mapStatus", () => {
      const store = useMapStore.getState()
      store.setMapStatus({ lat: 43.5, zoom: 9 })

      const state = useMapStore.getState()
      expect(state.mapStatus).toEqual({
        lat: 43.5,
        lng: 25.5,
        zoom: 9,
        elevation: 0,
        bearing: 0,
      })
    })

    it("should partialize store state correctly for persistence", () => {
      const partialize = useMapStore.persist.getOptions().partialize
      if (partialize) {
        const fullState = {
          camera: { lng: 23.3, lat: 42.7, zoom: 10, pitch: 15, bearing: 45 },
          flyToTarget: { lat: 42.1, lng: 24.5, zoom: 12 },
          mapView: "3d" as const,
          basemap: "satellite" as const,
          mapStatus: { lat: 43.5, lng: 25.5, zoom: 9, elevation: 0, bearing: 0 },
          mapInstance: {} as any,
          userLocation: { lat: 42.6, lng: 23.3 },
          setCamera: () => {},
          setFlyToTarget: () => {},
          setMapView: () => {},
          setBasemap: () => {},
          setMapStatus: () => {},
          setMapInstance: () => {},
          setUserLocation: () => {},
        }
        const partial = partialize(fullState)
        expect(partial).toEqual(expect.objectContaining({
          camera: { lng: 23.3, lat: 42.7, zoom: 10, pitch: 15, bearing: 45 },
          mapView: "3d",
          basemap: "satellite",
        }))
        expect((partial as any).mapStatus).toBeUndefined()
        expect((partial as any).flyToTarget).toBeUndefined()
        expect((partial as any).mapInstance).toBeUndefined()
        expect((partial as any).userLocation).toBeUndefined()
      } else {
        throw new Error("partialize function is not defined on useMapStore")
      }
    })
  })

  describe("useUIStore", () => {
    beforeEach(() => {
      useUIStore.setState({
        theme: "system",
        sidebarOpen: true,
        activeSidebarTab: "risk",
        secondaryBarOpen: true,
      })
    })

    it("should have correct initial values", () => {
      const state = useUIStore.getState()
      expect(state.theme).toBe("system")
      expect(state.sidebarOpen).toBe(true)
      expect(state.activeSidebarTab).toBe("risk")
      expect(state.secondaryBarOpen).toBe(true)
    })

    it("should update theme, sidebarOpen, activeSidebarTab, secondaryBarOpen", () => {
      const store = useUIStore.getState()
      store.setTheme("dark")
      store.setSidebarOpen(false)
      store.setActiveSidebarTab("alerts")
      store.setSecondaryBarOpen(false)

      const state = useUIStore.getState()
      expect(state.theme).toBe("dark")
      expect(state.sidebarOpen).toBe(false)
      expect(state.activeSidebarTab).toBe("alerts")
      expect(state.secondaryBarOpen).toBe(false)
    })
  })
})
