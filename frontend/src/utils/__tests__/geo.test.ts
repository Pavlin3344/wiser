import { describe, it, expect } from "vitest"
import {
  isPointInPolygon,
  lngLatToMercator,
  bulgariaBorder,
  bulgariaMercatorCoordinates,
  bulgariaBBoxMercator,
} from "@/utils/geo"

describe("geo utility module", () => {
  describe("isPointInPolygon", () => {
    // Simple 4x4 square centered at (0, 0)
    // Ring coordinates must close (first and last must match)
    const simplePolygon: number[][][] = [
      [
        [-2, -2],
        [2, -2],
        [2, 2],
        [-2, 2],
        [-2, -2],
      ],
    ]

    it("should return false if polygon has no exterior ring", () => {
      expect(isPointInPolygon([0, 0], [])).toBe(false)
    })

    it("should return true for a point strictly inside the polygon", () => {
      expect(isPointInPolygon([0, 0], simplePolygon)).toBe(true)
      expect(isPointInPolygon([1, 1], simplePolygon)).toBe(true)
    })

    it("should return false for a point strictly outside the polygon", () => {
      expect(isPointInPolygon([3, 3], simplePolygon)).toBe(false)
      expect(isPointInPolygon([-3, 0], simplePolygon)).toBe(false)
    })

    // Square with a 2x2 hole in the middle
    const polygonWithHole: number[][][] = [
      // Exterior ring (4x4)
      [
        [-2, -2],
        [2, -2],
        [2, 2],
        [-2, 2],
        [-2, -2],
      ],
      // Interior ring (hole) (2x2)
      [
        [-1, -1],
        [-1, 1],
        [1, 1],
        [1, -1],
        [-1, -1],
      ],
    ]

    it("should return false for a point inside the hole of a polygon", () => {
      expect(isPointInPolygon([0, 0], polygonWithHole)).toBe(false)
      expect(isPointInPolygon([0.5, -0.5], polygonWithHole)).toBe(false)
    })

    it("should return true for a point inside the polygon but outside the hole", () => {
      expect(isPointInPolygon([1.5, 1.5], polygonWithHole)).toBe(true)
      expect(isPointInPolygon([-1.5, 0], polygonWithHole)).toBe(true)
    })
  })

  describe("lngLatToMercator", () => {
    it("should correctly convert (0, 0) to Web Mercator", () => {
      const [x, y] = lngLatToMercator(0, 0)
      expect(x).toBeCloseTo(0)
      expect(y).toBeCloseTo(0)
    })

    it("should convert coordinates correctly for a typical point", () => {
      const lng = 23.3219 // Sofia, Bulgaria Lng
      const lat = 42.6977 // Sofia, Bulgaria Lat
      const [x, y] = lngLatToMercator(lng, lat)
      
      // Expected approximate values for Sofia in EPSG:3857:
      // X = lng * 20037508.34 / 180 ~ 2596181.74
      // Y = ln(tan((90 + lat) * pi / 360)) * 20037508.34 / pi ~ 5265507.03
      expect(x).toBeCloseTo(2596182.03, 1)
      expect(y).toBeCloseTo(5266071.32, 1)
    })
  })

  describe("Bulgaria boundary exports", () => {
    it("should import and project Bulgaria border successfully", () => {
      expect(bulgariaBorder.length).toBeGreaterThan(0)
      expect(bulgariaMercatorCoordinates.length).toEqual(bulgariaBorder.length)
    })

    it("should calculate valid bounding box for Bulgaria in Web Mercator", () => {
      expect(bulgariaBBoxMercator.minX).toBeLessThan(bulgariaBBoxMercator.maxX)
      expect(bulgariaBBoxMercator.minY).toBeLessThan(bulgariaBBoxMercator.maxY)
      
      // Values should be non-zero and around Bulgaria bounds
      expect(bulgariaBBoxMercator.minX).toBeGreaterThan(2000000)
      expect(bulgariaBBoxMercator.maxX).toBeLessThan(3500000)
    })
  })
})
