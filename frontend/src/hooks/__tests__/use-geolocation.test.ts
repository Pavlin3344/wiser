import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useGeolocation } from "@/hooks/use-geolocation"
import { useMapStore } from "@/store/use-map-store"

describe("useGeolocation custom hook", () => {
  let warnSpy: any
  let originalGeolocation: any

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    originalGeolocation = navigator.geolocation
    useMapStore.setState({
      mapInstance: null,
      userLocation: null,
      flyToTarget: null,
    })
  })

  afterEach(() => {
    warnSpy.mockRestore()
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
  })

  it("should successfully set user location, flyToTarget, and update map source if supported and allowed", () => {
    const mockSetData = vi.fn()
    const mockGetSource = vi.fn().mockReturnValue({
      setData: mockSetData,
    })
    const mockMapInstance = {
      getSource: mockGetSource,
    } as any

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
  })

  it("should warn if map source 'user-location' is not initialized yet", () => {
    const mockGetSource = vi.fn().mockReturnValue(null) // source not initialized
    const mockMapInstance = {
      getSource: mockGetSource,
    } as any

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
    
    // Stores should remain unmodified
    const state = useMapStore.getState()
    expect(state.userLocation).toBeNull()
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
