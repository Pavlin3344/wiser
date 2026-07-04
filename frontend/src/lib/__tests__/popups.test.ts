import { describe, it, expect } from "vitest"
import { generateGlassPopupHTML, generateSectorPopupHTML } from "@/lib/popups"

describe("lib/popups popup HTML generator helpers", () => {
  describe("generateGlassPopupHTML", () => {
    it("should construct valid HTML string containing escaped values and coordinates", () => {
      const date = "2026-07-04"
      const title = "Active Fire <Alert>"
      const intensity = "Critical"
      const coordinates = [23.32194, 42.69778]
      const dotColor = "bg-destructive"
      const textColor = "text-destructive"

      const html = generateGlassPopupHTML(date, title, intensity, coordinates, dotColor, textColor)

      // Verify date is there
      expect(html).toContain("2026-07-04")
      // Title should be HTML-escaped: '<Alert>' -> '&lt;Alert&gt;'
      expect(html).toContain("Active Fire &lt;Alert&gt;")
      // Intensity
      expect(html).toContain("Critical Risk")
      // Colors
      expect(html).toContain("bg-destructive")
      expect(html).toContain("text-destructive")
      // Coordinates toFixed(4): 23.32194 -> 23.3219 and 42.69778 -> 42.6978
      expect(html).toContain("23.3219°")
      expect(html).toContain("42.6978°")
    })
  })

  describe("generateSectorPopupHTML", () => {
    it("should construct valid HTML string for sectors containing stats", () => {
      const sectorId = "SEC-42"
      const level = "High <Risk>"
      const temp = 38
      const humidity = 15
      const dotColor = "bg-orange-500"
      const textColor = "text-orange-500"

      const html = generateSectorPopupHTML(sectorId, level, temp, humidity, dotColor, textColor)

      expect(html).toContain("SEC-42")
      // Level should be HTML-escaped: '<Risk>' -> '&lt;Risk&gt;'
      expect(html).toContain("Sector Status: High &lt;Risk&gt;")
      expect(html).toContain("bg-orange-500")
      expect(html).toContain("text-orange-500")
      expect(html).toContain("38°C")
      expect(html).toContain("15%")
    })
  })
})
