import { renderHook, act } from "@testing-library/react"
import { useIsMobile } from "@/hooks/use-mobile"
import { type Mock, vi } from "vitest"

describe("useIsMobile custom hook", () => {
  let addListenerMock: Mock
  let removeListenerMock: Mock
  let matchMediaMock: Mock

  beforeEach(() => {
    addListenerMock = vi.fn()
    removeListenerMock = vi.fn()

    matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: addListenerMock,
      removeListener: removeListenerMock,
      addEventListener: addListenerMock,
      removeEventListener: removeListenerMock,
      dispatchEvent: vi.fn(),
    }))

    vi.stubGlobal("matchMedia", matchMediaMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("should return false on desktop viewport (innerWidth >= 768)", () => {
    vi.stubGlobal("innerWidth", 1024)

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it("should return true on mobile viewport (innerWidth < 768)", () => {
    vi.stubGlobal("innerWidth", 500)
    matchMediaMock.mockImplementationOnce((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: addListenerMock,
      removeListener: removeListenerMock,
      addEventListener: addListenerMock,
      removeEventListener: removeListenerMock,
    }))

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it("should update state when viewport changes width", () => {
    let changeCallback: () => void = () => { }

    matchMediaMock.mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_event: string, callback: any) => {
        changeCallback = callback
      },
      removeEventListener: vi.fn(),
    }))

    vi.stubGlobal("innerWidth", 1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    // Simulate window resizing below breakpoint
    vi.stubGlobal("innerWidth", 600)
    act(() => {
      changeCallback()
    })

    expect(result.current).toBe(true)
  })
})
