import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchActiveFires, fetchEffisWmsFeatureInfo } from "@/services/fireService"
import type { FeatureCollection } from "geojson"

describe("fireService API service module", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("fetchActiveFires", () => {
    it("should successfully fetch and return active fire feature collection", async () => {
      const mockData: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [23.3, 42.7] },
            properties: { frp: 30, risk: "High" },
          },
        ],
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response)

      const result = await fetchActiveFires()
      
      expect(fetch).toHaveBeenCalledWith("/api/v1/fires/active")
      expect(result).toEqual(mockData)
    })

    it("should throw an error if the response is not ok", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

      await expect(fetchActiveFires()).rejects.toThrow("HTTP error 500")
      expect(fetch).toHaveBeenCalledWith("/api/v1/fires/active")
    })
  })

  describe("fetchEffisWmsFeatureInfo", () => {
    const mockParams = {
      layer: "modis",
      bbox: "20,40,30,50",
      width: 800,
      height: 600,
      x: 100,
      y: 200,
    }

    it("should construct the correct WMS URL and return response text on success", async () => {
      const mockResponseText = "Feature Info Details"
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockResponseText,
      } as Response)

      const result = await fetchEffisWmsFeatureInfo(mockParams)

      expect(fetch).toHaveBeenCalledTimes(1)
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string
      expect(calledUrl).toContain("/effis-wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo")
      expect(calledUrl).toContain("&LAYERS=modis&QUERY_LAYERS=modis")
      expect(calledUrl).toContain("&BBOX=20,40,30,50&WIDTH=800&HEIGHT=600")
      expect(calledUrl).toContain("&SRS=EPSG:3857&X=100&Y=200")
      expect(calledUrl).toContain("&STYLES=&INFO_FORMAT=text/plain")
      
      expect(result).toBe(mockResponseText)
    })

    it("should throw an error if the response is not ok", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      await expect(fetchEffisWmsFeatureInfo(mockParams)).rejects.toThrow("HTTP error 404")
    })
  })
})
