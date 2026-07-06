import { vi } from "vitest"
import "@testing-library/jest-dom"

// Mock window.matchMedia for media queries (used by useIsMobile custom hook)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock maplibre-gl since WebGL cannot run headlessly in JSDOM environments
vi.mock("maplibre-gl", () => {
  class LngLatMock {
    lng: number
    lat: number
    constructor(lng: number, lat: number) {
      this.lng = lng
      this.lat = lat
    }
    distanceTo() {
      return 1000 // default mock distance in meters
    }
  }

  const MapMock = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    addSource: vi.fn(),
    removeSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    getSource: vi.fn(),
    getLayer: vi.fn(),
    setPaintProperty: vi.fn(),
    setLayoutProperty: vi.fn(),
    setFilter: vi.fn(),
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    getCanvasContainer: vi.fn(() => document.createElement("div")),
    project: vi.fn(() => ({ x: 100, y: 100 })),
    unproject: vi.fn(() => new LngLatMock(0, 0)),
    getCenter: vi.fn(() => new LngLatMock(0, 0)),
    getContainer: vi.fn(() => ({ clientWidth: 1000, clientHeight: 1000 })),
  }))

  const NavigationControlMock = vi.fn()
  
  const MarkerMock = vi.fn().mockImplementation(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
    setPopup: vi.fn().mockReturnThis(),
  }))

  const PopupMock = vi.fn().mockImplementation(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    setHTML: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
  }))

  return {
    Map: MapMock,
    NavigationControl: NavigationControlMock,
    Marker: MarkerMock,
    Popup: PopupMock,
    LngLat: LngLatMock,
  };
})
