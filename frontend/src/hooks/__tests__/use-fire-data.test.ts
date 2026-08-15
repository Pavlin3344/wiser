import type { RefObject } from "react"
import type { FeatureCollection } from "geojson"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useFireData } from "@/hooks/use-fire-data"
import { fetchActiveFires } from "@/services/fireService"
import { syncLayers } from "@/hooks/use-map-layers"
import { useFilterStore, SENSOR_MODIS, SENSOR_VIIRS } from "@/store/use-filter-store"

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

    // The filter store is persisted and shared, so leaking a filter from one test
    // would silently change what another test sees.
    useFilterStore.setState({
      minConfidence: 0,
      enabledSensors: [SENSOR_MODIS, SENSOR_VIIRS],
      liveUpdates: true,
    })
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
    // Equality, not identity: the ref holds the filtered view of the response.
    expect(fireDataRef.current).toEqual(mockFetchedData)
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
    expect(fireDataRef.current).toEqual(mockFetchedData)
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

  // On failure the map must not be repainted with anything: stale detections shown as
  // current are more dangerous than an empty map, so nothing is drawn at all.
  it("should warn and draw nothing when the fetch is rejected", async () => {
    const mapRef = { current: mapMock } as any
    mapMock.loaded.mockReturnValue(true)

    const originalData = fireDataRef.current
    vi.mocked(fetchActiveFires).mockRejectedValueOnce(new Error("Network Down"))

    renderHook(() => useFireData({ mapRef, fireDataRef }))

    await act(async () => {
      await Promise.resolve() // let fetch resolve
      await Promise.resolve() // let .catch resolve
    })

    expect(fetchActiveFires).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith("[Wiser] Could not load active fires (Error: Network Down).")
    expect(fireDataRef.current).toBe(originalData)
    expect(syncLayers).not.toHaveBeenCalled()
  })

  it("should hide detections below the configured confidence threshold", async () => {
    const mapRef = { current: mapMock } as any
    mapMock.loaded.mockReturnValue(true)

    const feature = (confidence: number) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [23, 42] },
      properties: { confidence, source: SENSOR_MODIS },
    })

    vi.mocked(fetchActiveFires).mockResolvedValueOnce({
      type: "FeatureCollection",
      features: [feature(40), feature(90)],
    })

    useFilterStore.getState().setMinConfidence(80)

    renderHook(() => useFireData({ mapRef, fireDataRef }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(fireDataRef.current.features).toHaveLength(1)
    expect(fireDataRef.current.features[0].properties?.confidence).toBe(90)
  })

  it("should hide detections from a sensor that is switched off", async () => {
    const mapRef = { current: mapMock } as any
    mapMock.loaded.mockReturnValue(true)

    vi.mocked(fetchActiveFires).mockResolvedValueOnce({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [23, 42] }, properties: { source: SENSOR_MODIS } },
        { type: "Feature", geometry: { type: "Point", coordinates: [24, 42] }, properties: { source: SENSOR_VIIRS } },
      ],
    })

    useFilterStore.getState().toggleSensor(SENSOR_VIIRS, false)

    renderHook(() => useFireData({ mapRef, fireDataRef }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(fireDataRef.current.features).toHaveLength(1)
    expect(fireDataRef.current.features[0].properties?.source).toBe(SENSOR_MODIS)
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
