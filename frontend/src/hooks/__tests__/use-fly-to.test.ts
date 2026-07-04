import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useFlyTo } from "@/hooks/use-fly-to"
import { useMapStore } from "@/store/use-map-store"
import type { RefObject } from "react"
import type maplibregl from "maplibre-gl"

describe("useFlyTo custom hook", () => {
  let mapMock: any

  beforeEach(() => {
    vi.useFakeTimers()
    mapMock = {
      flyTo: vi.fn(),
    }
    useMapStore.setState({
      flyToTarget: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should not fly or clear target if map instance is null", () => {
    const mapRef = { current: null } as RefObject<maplibregl.Map | null>
    useMapStore.setState({ flyToTarget: { lng: 23, lat: 42, zoom: 12 } })

    renderHook(() => useFlyTo(mapRef))

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(useMapStore.getState().flyToTarget).not.toBeNull()
  })

  it("should not fly if flyToTarget is null", () => {
    const mapRef = { current: mapMock } as RefObject<maplibregl.Map | null>

    renderHook(() => useFlyTo(mapRef))

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(mapMock.flyTo).not.toHaveBeenCalled()
  })

  it("should flyTo target and clear flyToTarget after 100ms timeout", () => {
    const mapRef = { current: mapMock } as RefObject<maplibregl.Map | null>
    useMapStore.setState({ flyToTarget: { lng: 23.3, lat: 42.7, zoom: 10 } })

    renderHook(() => useFlyTo(mapRef))

    expect(mapMock.flyTo).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mapMock.flyTo).toHaveBeenCalledWith({
      center: [23.3, 42.7],
      zoom: 10,
      essential: true,
      duration: 2500,
    })

    expect(useMapStore.getState().flyToTarget).toBeNull()
  })

  it("should clear timeout on unmount", () => {
    const mapRef = { current: mapMock } as RefObject<maplibregl.Map | null>
    useMapStore.setState({ flyToTarget: { lng: 23.3, lat: 42.7, zoom: 10 } })

    const { unmount } = renderHook(() => useFlyTo(mapRef))
    unmount()

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(mapMock.flyTo).not.toHaveBeenCalled()
  })
})
