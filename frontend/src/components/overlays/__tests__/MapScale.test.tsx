import { render, screen, fireEvent, act } from "@testing-library/react"
import { MapScale } from "../MapScale"
import { useMapStore } from "@/store/use-map-store"
import { vi } from "vitest"
import type maplibregl from "maplibre-gl"

describe("MapScale Component", () => {
  let moveCallback: () => void = () => {}
  const mockMap = {
    getCenter: vi.fn().mockReturnValue({
      lng: 0,
      lat: 0,
      distanceTo: vi.fn().mockReturnValue(1200), // 1200 meters
    }),
    project: vi.fn().mockReturnValue({ x: 100, y: 100 }),
    unproject: vi.fn().mockReturnValue({ lng: 0.01, lat: 0 }),
    on: vi.fn().mockImplementation((event, callback) => {
      if (event === "move") {
        moveCallback = callback
      }
    }),
    off: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useMapStore.getState().setMapInstance(mockMap as unknown as maplibregl.Map)
  })

  afterEach(() => {
    useMapStore.getState().setMapInstance(null)
  })

  it("renders metric scale by default", async () => {
    await act(async () => {
      render(<MapScale variant="inline" />)
    })
    // 1200 meters -> multiplier = 1000, r = 1.2 -> rRound = 1 -> 1000m (1 km)
    expect(screen.getByText("1 km")).toBeInTheDocument()
  })

  it("toggles unit when clicked", async () => {
    await act(async () => {
      render(<MapScale variant="inline" />)
    })
    const button = screen.getByRole("button")
    expect(screen.getByText("1 km")).toBeInTheDocument()

    // Click to toggle to imperial
    await act(async () => {
      fireEvent.click(button)
    })
    // 1200 meters * 3.28084 = 3937 feet
    // getDecimalRoundNum(3937) -> multiplier = 1000, r = 3.937 -> rRound = 2 -> 2000 ft
    expect(screen.getByText("2000 ft")).toBeInTheDocument()

    // Click again to toggle back to metric
    await act(async () => {
      fireEvent.click(button)
    })
    expect(screen.getByText("1 km")).toBeInTheDocument()
  })

  it("re-calculates scale when map move event fires", async () => {
    await act(async () => {
      render(<MapScale variant="inline" />)
    })
    expect(screen.getByText("1 km")).toBeInTheDocument()

    // Change map's center distance
    mockMap.getCenter.mockReturnValueOnce({
      lng: 0,
      lat: 0,
      distanceTo: vi.fn().mockReturnValue(550), // 550 meters
    })

    // Trigger map move event callback
    await act(async () => {
      moveCallback()
    })

    // 550 meters -> multiplier = 100, r = 5.5 -> rRound = 5 -> 500m
    expect(screen.getByText("500 m")).toBeInTheDocument()
  })

  it("renders floating variant with glassmorphic container", async () => {
    let result: any
    await act(async () => {
      result = render(<MapScale variant="floating" />)
    })
    const button = screen.getByRole("button")
    expect(button).toHaveClass("bg-background/60", "backdrop-blur-xl")
    expect(result.container.firstChild).toBeInTheDocument()
  })
})
