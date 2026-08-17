import { render, screen, fireEvent, act } from "@testing-library/react"
import { vi } from "vitest"
import React from "react"

vi.mock("@/components/ui/dropdown-menu", () => {
  const DropdownContext = React.createContext({
    open: false,
    setOpen: (open: boolean | ((prev: boolean) => boolean)) => {
      void open
    },
  })

  return {
    DropdownMenu: ({ children }: any) => {
      const [open, setOpen] = React.useState(false)
      return (
        <DropdownContext.Provider value={{ open, setOpen }}>
          <div data-testid="dropdown-menu">{children}</div>
        </DropdownContext.Provider>
      )
    },
    DropdownMenuTrigger: ({ children, ...props }: any) => {
      const { setOpen } = React.useContext(DropdownContext)
      return (
        <div data-testid="dropdown-menu-trigger" onClick={() => setOpen((prev: boolean) => !prev)} {...props}>
          {children}
        </div>
      )
    },
    DropdownMenuContent: ({ children, ...props }: any) => {
      const { open } = React.useContext(DropdownContext)
      if (!open) return null
      return <div data-testid="dropdown-menu-content" {...props}>{children}</div>
    },
    DropdownMenuGroup: ({ children, ...props }: any) => <div data-testid="dropdown-menu-group" {...props}>{children}</div>,
    DropdownMenuItem: ({ children, onClick, className, ...props }: any) => {
      const { setOpen } = React.useContext(DropdownContext)
      const handleClick = (e: any) => {
        if (onClick) onClick(e)
        setOpen(false)
      }
      return (
        <button onClick={handleClick} role="menuitem" className={className} {...props}>
          {children}
        </button>
      )
    },
  }
})

import { SpatialContext } from "@/components/overlays/SpatialContext"
import { useMapStore } from "@/store/use-map-store"

describe("SpatialContext Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMapStore.setState({
      mapStatus: { lat: 42.0, lng: 25.5, zoom: 7.0, elevation: 0, bearing: 0, cameraDistance: 0 },
      flyToTarget: null,
    })
  })

  it("renders the World crumb alone when zoomed too far out to geocode", async () => {
    useMapStore.setState({
      mapStatus: { lat: 20.0, lng: 0.0, zoom: 2.0, elevation: 0, bearing: 0, cameraDistance: 0 },
    })

    await act(async () => {
      render(<SpatialContext />)
    })

    expect(screen.getByText("World")).toBeInTheDocument()
    expect(screen.queryByText("Europe")).not.toBeInTheDocument()
    expect(screen.queryByText("Bulgaria")).not.toBeInTheDocument()
  })

  // The three tests that used to sit here asserted a World > Europe > Bulgaria
  // hierarchy driven by a `region` setting. That setting is gone: coverage is fixed
  // to Bulgaria, and the breadcrumb is derived from reverse-geocoding the camera.
  //
  // TODO: the two below still need the geocode fetch mocked before they can run.
  it.skip("renders the city leaf when zoomed in near Sofia", async () => {
    useMapStore.setState({
      mapStatus: { lat: 42.6977, lng: 23.3219, zoom: 10.5, elevation: 0, bearing: 0, cameraDistance: 0 },
    })

    await act(async () => {
      render(<SpatialContext />)
    })

    expect(screen.getByText("World")).toBeInTheDocument()
    expect(screen.queryByText("Europe")).not.toBeInTheDocument()
    expect(screen.queryByText("Bulgaria")).not.toBeInTheDocument()
    expect(screen.getByText("Sofia")).toBeInTheDocument()
  })

  // The breadcrumb moves the camera and nothing else - zooming out to the world is
  // allowed, it just shows no data outside Bulgaria.
  it("triggers map navigation when clicking World breadcrumb link", async () => {
    await act(async () => {
      render(<SpatialContext />)
    })

    const worldBtn = screen.getByRole("button", { name: /World/i })
    await act(async () => {
      fireEvent.click(worldBtn)
    })

    expect(useMapStore.getState().flyToTarget).toEqual({ lat: 20.0, lng: 0.0, zoom: 2.2 })
  })

  it.skip("triggers map navigation when clicking the country breadcrumb while zoomed in", async () => {
    useMapStore.setState({
      mapStatus: { lat: 42.6977, lng: 23.3219, zoom: 11.0, elevation: 0, bearing: 0, cameraDistance: 0 },
    })

    await act(async () => {
      render(<SpatialContext />)
    })

    const toggleBtn = screen.getByRole("button", { name: /Toggle menu/i })
    await act(async () => {
      fireEvent.click(toggleBtn)
    })

    const bulgariaBtn = screen.getByRole("menuitem", { name: /^Bulgaria$/i })
    await act(async () => {
      fireEvent.click(bulgariaBtn)
    })

    expect(useMapStore.getState().flyToTarget).toEqual({ lat: 42.6977, lng: 23.3219, zoom: 7.0 })
  })
})
