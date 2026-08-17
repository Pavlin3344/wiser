import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchAirQualityHistory, fetchLatestAirQuality } from "@/services/airQualityService"

describe("airQualityService API service module", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("fetchLatestAirQuality", () => {
    it("should return the readings reported per sampling point", async () => {
      const mockData = [
        { time: "2026-08-17T12:00:00Z", lat: 41.58, lon: 22.94, source: "open-meteo-cams", no2: 4.1, pm25: 12.3, pm10: 20.5, co: 180 },
      ]

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response)

      const result = await fetchLatestAirQuality()

      expect(fetch).toHaveBeenCalledWith("/api/v1/air-quality/latest")
      expect(result).toEqual(mockData)
    })

    it("should throw an error if the response is not ok", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 503 } as Response)

      await expect(fetchLatestAirQuality()).rejects.toThrow("HTTP error 503")
    })
  })

  describe("fetchAirQualityHistory", () => {
    it("should request 24 hours by default", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)

      await fetchAirQualityHistory()

      expect(fetch).toHaveBeenCalledWith("/api/v1/air-quality/history?hours=24")
    })

    it("should pass the requested window through to the endpoint", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)

      await fetchAirQualityHistory(168)

      expect(fetch).toHaveBeenCalledWith("/api/v1/air-quality/history?hours=168")
    })

    it("should throw an error if the response is not ok", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 400 } as Response)

      await expect(fetchAirQualityHistory(1)).rejects.toThrow("HTTP error 400")
    })
  })
})
