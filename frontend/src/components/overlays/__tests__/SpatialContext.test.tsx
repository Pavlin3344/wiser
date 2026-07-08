import { render, screen, fireEvent, act } from "@testing-library/react"
import { vi } from "vitest"
import { SpatialContext } from "@/components/overlays/SpatialContext"
import { useFilterStore } from "@/store/use-filter-store"
import { useMapStore } from "@/store/use-map-store"

describe("SpatialContext Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFilterStore.setState({
      region: "world",
    })
    useMapStore.setState({
      mapStatus: { lat: 42.0, lng: 25.5, zoom: 7.0, elevation: 0, bearing: 0, cameraDistance: 0 },
      flyToTarget: null,
    })
  })

  it("renders World page by default when region is world", async () => {
    await act(async () => {
      render(<SpatialContext />)
    })

    expect(screen.getByText("World")).toBeInTheDocument()
    expect(screen.queryByText("Europe")).not.toBeInTheDocument()
    expect(screen.queryByText("Bulgaria")).not.toBeInTheDocument()
  })

  it("renders World > Europe > Bulgaria hierarchy when region is bulgaria", async () => {
    useFilterStore.setState({ region: "bulgaria" })

    await act(async () => {
      render(<SpatialContext />)
    })

    expect(screen.getByText("World")).toBeInTheDocument()
    expect(screen.getByText("Europe")).toBeInTheDocument()
    expect(screen.getByText("Bulgaria")).toBeInTheDocument()
  })

  it("renders Sofia leaf when region is bulgaria and zoom is high near Sofia coords", async () => {
    useFilterStore.setState({ region: "bulgaria" })
    useMapStore.setState({
      mapStatus: { lat: 42.6977, lng: 23.3219, zoom: 10.5, elevation: 0, bearing: 0, cameraDistance: 0 },
    })

    await act(async () => {
      render(<SpatialContext />)
    })

    expect(screen.getByText("World")).toBeInTheDocument()
    expect(screen.getByText("Europe")).toBeInTheDocument()
    expect(screen.getByText("Bulgaria")).toBeInTheDocument()
    expect(screen.getByText("Sofia (Zoom 10.5)")).toBeInTheDocument()
  })

  it("triggers map navigation when clicking World breadcrumb link", async () => {
    useFilterStore.setState({ region: "bulgaria" })

    await act(async () => {
      render(<SpatialContext />)
    })

    const worldBtn = screen.getByRole("button", { name: /World/i })
    await act(async () => {
      fireEvent.click(worldBtn)
    })

    expect(useFilterStore.getState().region).toBe("world")
    expect(useMapStore.getState().flyToTarget).toEqual({ lat: 20.0, lng: 0.0, zoom: 2.2 })
  })

  it("triggers map navigation when clicking Europe breadcrumb link", async () => {
    useFilterStore.setState({ region: "bulgaria" })

    await act(async () => {
      render(<SpatialContext />)
    })

    const europeBtn = screen.getByRole("button", { name: /Europe/i })
    await act(async () => {
      fireEvent.click(europeBtn)
    })

    expect(useFilterStore.getState().region).toBe("world")
    expect(useMapStore.getState().flyToTarget).toEqual({ lat: 48.0, lng: 15.0, zoom: 4.0 })
  })

  it("triggers map navigation when clicking Bulgaria breadcrumb link while zoomed in", async () => {
    useFilterStore.setState({ region: "bulgaria" })
    useMapStore.setState({
      mapStatus: { lat: 42.6977, lng: 23.3219, zoom: 11.0, elevation: 0, bearing: 0, cameraDistance: 0 },
    })

    await act(async () => {
      render(<SpatialContext />)
    })

    const bulgariaBtn = screen.getByRole("button", { name: /^Bulgaria$/i })
    await act(async () => {
      fireEvent.click(bulgariaBtn)
    })

    expect(useFilterStore.getState().region).toBe("bulgaria")
    expect(useMapStore.getState().flyToTarget).toEqual({ lat: 42.7, lng: 25.3, zoom: 7.3 })
  })
})
