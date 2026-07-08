import type { RefObject } from "react"
import type { FeatureCollection } from "geojson"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useFireData } from "@/hooks/use-fire-data"
import { fetchActiveFires } from "@/services/fireService"
import { syncLayers } from "@/hooks/use-map-layers"

// Mock dependencies
vi.mock("@/services/fireService", () => ({
  fetchActiveFires: vi.fn(),
}))

vi.mock("@/hooks/use-map-layers", () => ({
  syncLayers: vi.fn(),
}))

describe("useFireData custom hook", () => {
  let warnSpy: any
  let mapMock: any
  let fireDataRef: RefObject<FeatureCollection>

  beforeEach(() => {
    vi.useFakeTimers()
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { })

    // Mock map instance
    mapMock = {
      loaded: vi.fn().mockReturnValue(true),
      once: vi.fn(),
      off: vi.fn(),
    }

    // Initial mock data ref
    const mockInitialData: FeatureCollection = {
      type: "FeatureCollection",
      features: [],
    }
    fireDataRef = { current: mockInitialData }

    vi.mocked(fetchActiveFires).mockReset()
    vi.mocked(syncLayers).mockReset()
  })

  afterEach(() => {
    warnSpy.mockRestore()
    vi.useRealTimers()
  })

  it("should do nothing if map is null", () => {
    const mapRef = { current: null } as any
    renderHook(() => useFireData({ mapRef, fireDataRef }))

    expect(fetchActiveFires).not.toHaveBeenCalled()
    expect(mapMock.once).not.toHaveBeenCalled()
  })

  it("should wait for map load event if map is not yet loaded", async () => {
    const mapRef = { current: mapMock } as any
    mapMock.loaded.mockReturnValue(false)

    renderHook(() => useFireData({ mapRef, fireDataRef }))

    expect(mapMock.once).toHaveBeenCalledWith("load", expect.any(Function))
    expect(fetchActiveFires).not.toHaveBeenCalled()

    // Simulate map load event
    const loadCallback = mapMock.once.mock.calls[0][1]

    const mockFetchedData: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [23, 42] },
          properties: {},
        },
      ],
    }
    vi.mocked(fetchActiveFires).mockResolvedValueOnce(mockFetchedData)

    await act(async () => {
      loadCallback()
    })

    expect(fetchActiveFires).toHaveBeenCalled()
    expect(fireDataRef.current).toBe(mockFetchedData)
    expect(syncLayers).toHaveBeenCalledWith(mapMock, mockFetchedData)
  })

  it("should fetch immediately if map is already loaded", async () => {
    const mapRef = { current: mapMock } as any
    mapMock.loaded.mockReturnValue(true)

    const mockFetchedData: FeatureCollection = {
      type: "FeatureCollection",
      features: [],
    }
    vi.mocked(fetchActiveFires).mockResolvedValueOnce(mockFetchedData)

    renderHook(() => useFireData({ mapRef, fireDataRef }))

    // Flush promises
    await act(async () => {
      await Promise.resolve()
    })

    expect(mapMock.once).not.toHaveBeenCalled()
    expect(fetchActiveFires).toHaveBeenCalled()
    expect(fireDataRef.current).toBe(mockFetchedData)
    expect(syncLayers).toHaveBeenCalledWith(mapMock, mockFetchedData)
  })

  it("should poll on regular interval", async () => {
    const mapRef = { current: mapMock } as any
    mapMock.loaded.mockReturnValue(true)

    vi.mocked(fetchActiveFires).mockResolvedValue({
      type: "FeatureCollection",
      features: [],
    })

    renderHook(() => useFireData({ mapRef, fireDataRef }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchActiveFires).toHaveBeenCalledTimes(1)

    // Advance by 5 minutes
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000)
    })
    expect(fetchActiveFires).toHaveBeenCalledTimes(2)

    // Advance by another 5 minutes
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000)
    })
    expect(fetchActiveFires).toHaveBeenCalledTimes(3)
  })

  it("should fallback to current data ref and warn on API fetch rejection", async () => {
    const mapRef = { current: mapMock } as any
    mapMock.loaded.mockReturnValue(true)

    const originalData = fireDataRef.current
    const fetchError = new Error("Network Down")
    vi.mocked(fetchActiveFires).mockRejectedValueOnce(fetchError)

    renderHook(() => useFireData({ mapRef, fireDataRef }))

    await act(async () => {
      await Promise.resolve() // let fetch resolve
      await Promise.resolve() // let .catch resolve
    })

    expect(fetchActiveFires).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith("[Wiser] Backend unavailable (Error: Network Down). Using EFFIS mock data.")
    // Data ref remains unchanged
    expect(fireDataRef.current).toBe(originalData)
    expect(syncLayers).toHaveBeenCalledWith(mapMock, originalData)
  })

  it("should clean up event listener and interval on unmount", () => {
    const mapRef = { current: mapMock } as any
    mapMock.loaded.mockReturnValue(true)

    vi.mocked(fetchActiveFires).mockResolvedValue({
      type: "FeatureCollection",
      features: [],
    })

    const { unmount } = renderHook(() => useFireData({ mapRef, fireDataRef }))

    unmount()

    expect(mapMock.off).toHaveBeenCalledWith("load", expect.any(Function))

    // Timer advancement should not call fetchActiveFires anymore
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000)
    })
    expect(fetchActiveFires).toHaveBeenCalledTimes(1) // only initial on mount
  })
})
