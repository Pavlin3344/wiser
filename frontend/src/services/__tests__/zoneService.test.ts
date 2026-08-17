import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchRiskZones } from "@/services/zoneService"

const square = { type: "Polygon" as const, coordinates: [[[22, 42], [23, 42], [23, 43], [22, 43], [22, 42]]] }

const row = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  geom: square,
  fwiClass: 3,
  fwiValue: 25.4,
  ndviMean: 0.45,
  fuelType: 4,
  riskClass: 4,
  riskScore: 0.667,
  computedAt: "2026-08-17T07:00:00Z",
  validDate: "2026-08-17",
  ...overrides,
})

describe("zoneService API service module", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("should turn table rows into a feature collection MapLibre can draw", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [row(1)] } as Response)

    const result = await fetchRiskZones()

    expect(fetch).toHaveBeenCalledWith("/api/zones/risk")
    expect(result.type).toBe("FeatureCollection")
    expect(result.features).toHaveLength(1)
    expect(result.features[0].geometry).toEqual(square)
  })

  it("should keep the model inputs as feature properties and drop the geometry field", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [row(1)] } as Response)

    const { properties } = (await fetchRiskZones()).features[0]

    expect(properties.riskClass).toBe(4)
    expect(properties.fwiValue).toBe(25.4)
    expect(properties.ndviMean).toBe(0.45)
    expect(properties.fuelType).toBe(4)
    expect(properties.validDate).toBe("2026-08-17")
    expect("geom" in properties).toBe(false)
  })

  it("should preserve a null input rather than reporting it as a measured zero", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [row(1, { ndviMean: null, fuelType: null })],
    } as Response)

    const { properties } = (await fetchRiskZones()).features[0]

    expect(properties.ndviMean).toBeNull()
    expect(properties.fuelType).toBeNull()
  })

  // A row without geometry drawn at [0,0] would put a Bulgarian risk cell in the
  // Gulf of Guinea, which reads as real data rather than as a missing row.
  it("should drop rows whose geometry is missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [row(1), row(2, { geom: null })],
    } as Response)

    const result = await fetchRiskZones()

    expect(result.features).toHaveLength(1)
    expect(result.features[0].properties.id).toBe(1)
  })

  it("should return an empty collection when the batch has produced nothing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)

    expect((await fetchRiskZones()).features).toEqual([])
  })

  it("should throw an error if the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response)

    await expect(fetchRiskZones()).rejects.toThrow("HTTP error 500")
  })
})
