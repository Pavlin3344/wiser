import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type maplibregl from "maplibre-gl"
import { useGeolocation } from "@/hooks/use-geolocation"
import { useMapStore } from "@/store/use-map-store"
import { toast } from "sonner"

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}))

describe("useGeolocation custom hook", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let originalGeolocation: Geolocation | undefined
  let originalLocation: Location

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { })
    originalGeolocation = navigator.geolocation
    originalLocation = window.location

    useMapStore.setState({
      mapInstance: null,
      userLocation: null,
      flyToTarget: null,
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    warnSpy.mockRestore()
    vi.stubGlobal("window", { ...window, location: originalLocation })
    if (originalGeolocation) {
      vi.stubGlobal("navigator", { ...navigator, geolocation: originalGeolocation })
    } else {
      vi.unstubAllGlobals()
    }
  })

  it("should warn if geolocation is not supported", () => {
    vi.stubGlobal("navigator", { geolocation: undefined })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.findMe()
    })

    expect(warnSpy).toHaveBeenCalledWith("[Wiser] Geolocation is not supported by this browser.")
    expect(toast.error).toHaveBeenCalledWith("Geolocation Unsupported", {
      description: "Geolocation is not supported by your browser or current settings.",
      duration: 8000,
    })
  })

  it("should warn if geolocation is not supported on insecure HTTP host", () => {
    vi.stubGlobal("navigator", { geolocation: undefined })
    vi.stubGlobal("window", {
      ...window,
      location: {
        protocol: "http:",
        hostname: "wiser-app.com",
      },
    })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.findMe()
    })

    expect(warnSpy).toHaveBeenCalledWith("[Wiser] Geolocation is not supported by this browser.")
    expect(toast.error).toHaveBeenCalledWith("Geolocation Unsupported", {
      description: "Geolocation requires a secure connection (HTTPS) on deployed servers. Please configure SSL/HTTPS.",
      duration: 8000,
    })
  })

  it("should successfully set user location, flyToTarget, and update map source if supported and allowed", () => {
    const mockSetData = vi.fn()
    const mockGetSource = vi.fn().mockReturnValue({
      setData: mockSetData,
    })
    const mockMapInstance = {
      getSource: mockGetSource,
    } as unknown as maplibregl.Map

    useMapStore.setState({ mapInstance: mockMapInstance })

    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 42.6977,
            longitude: 23.3219,
          },
        })
      }),
    }
    vi.stubGlobal("navigator", { geolocation: mockGeolocation })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.findMe()
    })

    const state = useMapStore.getState()
    expect(state.userLocation).toEqual({ lat: 42.6977, lng: 23.3219 })
    expect(state.flyToTarget).toEqual({ lat: 42.6977, lng: 23.3219, zoom: 12 })
    expect(mockGetSource).toHaveBeenCalledWith("user-location")
    expect(mockSetData).toHaveBeenCalledWith({
      type: "Feature",
      geometry: { type: "Point", coordinates: [23.3219, 42.6977] },
      properties: {},
    })
    // No toast should be shown on success
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("should warn if map source 'user-location' is not initialized yet", () => {
    const mockGetSource = vi.fn().mockReturnValue(null) // source not initialized
    const mockMapInstance = {
      getSource: mockGetSource,
    } as unknown as maplibregl.Map

    useMapStore.setState({ mapInstance: mockMapInstance })

    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 42.6977,
            longitude: 23.3219,
          },
        })
      }),
    }
    vi.stubGlobal("navigator", { geolocation: mockGeolocation })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.findMe()
    })

    expect(warnSpy).toHaveBeenCalledWith("[Wiser] Source 'user-location' not initialized yet.")
    expect(toast.warning).toHaveBeenCalledWith("User location map source is not initialized yet")
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("should log console warning on geolocation error", () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((_success, error) => {
        error({
          code: 1,
          message: "User denied Geolocation",
        })
      }),
    }
    vi.stubGlobal("navigator", { geolocation: mockGeolocation })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.findMe()
    })

    expect(warnSpy).toHaveBeenCalledWith("[Wiser] Geolocation error (1): User denied Geolocation")
    expect(toast.error).toHaveBeenCalledWith("Permission Denied", {
      description: "Location permission denied. Please allow location access in your browser settings.",
      duration: 8000,
    })

    // Stores should remain unmodified
    const state = useMapStore.getState()
    expect(state.userLocation).toBeNull()
  })

  it("should show insecure origin message when permission is denied on HTTP deployed host", () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((_success, error) => {
        error({
          code: 1,
          message: "Only secure origins are allowed",
        })
      }),
    }
    vi.stubGlobal("navigator", { geolocation: mockGeolocation })
    vi.stubGlobal("window", {
      ...window,
      location: {
        protocol: "http:",
        hostname: "wiser-app.com",
      },
    })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.findMe()
    })

    expect(warnSpy).toHaveBeenCalledWith("[Wiser] Geolocation error (1): Only secure origins are allowed")
    expect(toast.error).toHaveBeenCalledWith("Permission Denied", {
      description: "Location permission denied. Geolocation requires a secure connection (HTTPS) on deployed servers. Please configure SSL/HTTPS.",
      duration: 8000,
    })
  })

  it("should return early without errors/warnings if mapInstance is null on success", () => {
    useMapStore.setState({ mapInstance: null })
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 42.6977,
            longitude: 23.3219,
          },
        })
      }),
    }
    vi.stubGlobal("navigator", { geolocation: mockGeolocation })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.findMe()
    })

    const state = useMapStore.getState()
    expect(state.userLocation).toEqual({ lat: 42.6977, lng: 23.3219 })
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
