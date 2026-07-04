import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { usePWAInstall } from "@/hooks/use-pwa-install"

describe("usePWAInstall custom hook", () => {
  let logSpy: any
  let errorSpy: any
  let matchMediaMock: any

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    
    // Default matchMedia mock (non-standalone)
    matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    vi.stubGlobal("matchMedia", matchMediaMock)
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it("should initialize with default states for desktop/browser", () => {
    const { result } = renderHook(() => usePWAInstall())

    expect(result.current.installPrompt).toBeNull()
    expect(result.current.isInstalled).toBe(false)
    expect(result.current.isIOS).toBe(false)
    expect(result.current.isStandalone).toBe(false)
  })

  it("should detect iOS device correctly from user agent", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
    })

    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.isIOS).toBe(true)
  })

  it("should detect standalone mode when display-mode matches", () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query.includes("display-mode: standalone"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.isStandalone).toBe(true)
    expect(result.current.isInstalled).toBe(true)
  })

  it("should detect standalone mode when navigator.standalone is true", () => {
    vi.stubGlobal("navigator", {
      userAgent: "browser",
      standalone: true,
    })

    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.isStandalone).toBe(true)
    expect(result.current.isInstalled).toBe(true)
  })

  it("should handle beforeinstallprompt event and prevent default", () => {
    const { result } = renderHook(() => usePWAInstall())

    const mockPreventDefault = vi.fn()
    const mockEvent = new Event("beforeinstallprompt") as any
    mockEvent.preventDefault = mockPreventDefault

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    expect(mockPreventDefault).toHaveBeenCalled()
    expect(result.current.installPrompt).toBe(mockEvent)
  })

  it("should handle appinstalled event", () => {
    const { result } = renderHook(() => usePWAInstall())

    // First trigger beforeinstallprompt to populate hook state
    const beforeInstallEvent = new Event("beforeinstallprompt") as any
    beforeInstallEvent.preventDefault = vi.fn()
    act(() => {
      window.dispatchEvent(beforeInstallEvent)
    })
    expect(result.current.installPrompt).toBe(beforeInstallEvent)

    // Now trigger appinstalled
    const installedEvent = new Event("appinstalled")
    act(() => {
      window.dispatchEvent(installedEvent)
    })

    expect(result.current.installPrompt).toBeNull()
    expect(result.current.isInstalled).toBe(true)
    expect(logSpy).toHaveBeenCalledWith("PWA was installed successfully")
  })

  it("should call install prompt flow and clear prompt if user accepts", async () => {
    const { result } = renderHook(() => usePWAInstall())

    const promptSpy = vi.fn().mockResolvedValue(undefined)
    const mockEvent = new Event("beforeinstallprompt") as any
    mockEvent.preventDefault = vi.fn()
    mockEvent.prompt = promptSpy
    mockEvent.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" })

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    await act(async () => {
      await result.current.install()
    })

    expect(promptSpy).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith("User response to install prompt: accepted")
    expect(result.current.installPrompt).toBeNull()
  })

  it("should call install prompt flow and keep prompt if user dismisses", async () => {
    const { result } = renderHook(() => usePWAInstall())

    const promptSpy = vi.fn().mockResolvedValue(undefined)
    const mockEvent = new Event("beforeinstallprompt") as any
    mockEvent.preventDefault = vi.fn()
    mockEvent.prompt = promptSpy
    mockEvent.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" })

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    await act(async () => {
      await result.current.install()
    })

    expect(promptSpy).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith("User response to install prompt: dismissed")
    expect(result.current.installPrompt).toBe(mockEvent) // stays set
  })

  it("should handle error in install prompt flow gracefully", async () => {
    const { result } = renderHook(() => usePWAInstall())

    const mockEvent = new Event("beforeinstallprompt") as any
    mockEvent.preventDefault = vi.fn()
    const testError = new Error("Prompt failed")
    mockEvent.prompt = vi.fn().mockRejectedValue(testError)

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    await act(async () => {
      await result.current.install()
    })

    expect(errorSpy).toHaveBeenCalledWith("Installation prompt failed:", testError)
  })

  it("should return early from install() if installPrompt is null", async () => {
    const { result } = renderHook(() => usePWAInstall())
    await act(async () => {
      await result.current.install()
    })
    expect(result.current.installPrompt).toBeNull()
  })
})
