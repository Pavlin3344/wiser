import { create } from "zustand"
import { persist, subscribeWithSelector } from "zustand/middleware"
import type maplibregl from "maplibre-gl"

export interface Camera {
  lng: number
  lat: number
  zoom: number
  pitch: number
  bearing: number
}

/** High-frequency map UI state — updated every mousemove / zoom.
 *  Consumers should read this via useMapStore.subscribe() to avoid
 *  re-rendering the entire React tree on every pointer event. */
export interface MapStatus {
  lat: number
  lng: number
  zoom: number
  elevation: number
  bearing: number
  cameraDistance: number
}


interface MapState {
  camera: Camera
  setCamera: (camera: Camera) => void

  flyToTarget: { lat: number; lng: number; zoom: number } | null
  setFlyToTarget: (target: { lat: number; lng: number; zoom: number } | null) => void

  mapView: "2d" | "3d"
  setMapView: (view: "2d" | "3d") => void

  basemap: "topographic" | "satellite"
  setBasemap: (map: "topographic" | "satellite") => void

  scaleUnit: "metric" | "imperial"
  setScaleUnit: (unit: "metric" | "imperial") => void

  /** Updated every mousemove/zoom — consume via useMapStore.subscribe(),
   *  NOT via useMapStore() hook, to avoid re-renders. */
  mapStatus: MapStatus
  setMapStatus: (status: Partial<MapStatus>) => void

  mapInstance: maplibregl.Map | null
  setMapInstance: (map: maplibregl.Map | null) => void

  userLocation: { lat: number; lng: number } | null
  setUserLocation: (loc: { lat: number; lng: number } | null) => void
}

export const useMapStore = create<MapState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        camera: { lng: 25.5, lat: 42.0, zoom: 7, pitch: 0, bearing: 0 },
        setCamera: (camera) => set({ camera }),

        flyToTarget: null,
        setFlyToTarget: (flyToTarget) => set({ flyToTarget }),

        mapView: "2d",
        setMapView: (mapView) => set({ mapView }),

        basemap: "satellite",
        setBasemap: (basemap) => set({ basemap }),

        scaleUnit: "metric",
        setScaleUnit: (scaleUnit) => set({ scaleUnit }),

        mapStatus: { lat: 42.0, lng: 25.5, zoom: 7, elevation: 0, bearing: 0, cameraDistance: 0 },
        setMapStatus: (partial) => set((s) => ({ mapStatus: { ...s.mapStatus, ...partial } })),

        mapInstance: null,
        setMapInstance: (mapInstance) => set({ mapInstance }),

        userLocation: null,
        setUserLocation: (userLocation) => set({ userLocation }),
      }),
      {
        name: "wiser-system-storage",
        // Introduced when the opening basemap became satellite. Every browser that had
        // ever loaded the site held "topographic" here, so the new default alone would
        // have reached nobody but a first-time visitor. migrate rather than a bare
        // version bump: without one zustand discards the whole persisted object, and
        // camera and scaleUnit are the visitor's own settings with no reason to reset.
        version: 1,
        migrate: (persisted) => ({
          ...(persisted as Pick<MapState, "camera" | "mapView" | "basemap" | "scaleUnit">),
          basemap: "satellite" as const,
        }),
        // mapStatus, flyToTarget, userLocation and mapInstance are transient — never persist them
        partialize: (state) => ({
          camera: state.camera,
          mapView: state.mapView,
          basemap: state.basemap,
          scaleUnit: state.scaleUnit,
        }),
      },
    ),
  ),
)
