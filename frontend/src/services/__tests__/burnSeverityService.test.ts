import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchBurnSeverity } from "@/services/burnSeverityService"

const analysis = {
  id: 1,
  fireId: 42,
  geom: { type: "Polygon", coordinates: [[[23, 42], [23.1, 42], [23.1, 42.1], [23, 42.1], [23, 42]]] },
  preDate: "2026-07-01",
  postDate: "2026-07-20",
  rasterPath: "dnbr/2026-07-20/T34TGN.tif",
  meanDnbr: 0.42,
  burnedHectares: 128.5,
  analysedHectares: 900,
  haRegrowth: 3, haUnburned: 768.5, haLow: 60, haModerateLow: 40, haModerateHigh: 16.25, haHigh: 12.25,
  computedAt: "2026-07-21T03:00:00Z",
}

describe("burnSeverityService API service module", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it("should return the completed analyses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [analysis] } as Response)

    const result = await fetchBurnSeverity()

    expect(fetch).toHaveBeenCalledWith("/api/burn-severity?limit=20")
    expect(result).toHaveLength(1)
    expect(result[0].burnedHectares).toBe(128.5)
  })

  it("should pass the requested limit through", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)

    await fetchBurnSeverity(5)

    expect(fetch).toHaveBeenCalledWith("/api/burn-severity?limit=5")
  })

  it("should return an empty list when nothing has been analysed yet", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)

    expect(await fetchBurnSeverity()).toEqual([])
  })

  it("should throw an error if the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response)

    await expect(fetchBurnSeverity()).rejects.toThrow("HTTP error 500")
  })
})
