import { intensityStyle, escHtml, eaqiBand } from "@/utils/helpers"

describe("helpers utility module", () => {
  describe("intensityStyle", () => {
    it("should return critical styling for FRP > 50", () => {
      const result = intensityStyle(55)
      expect(result).toEqual({
        dot: "bg-destructive",
        text: "text-destructive",
        label: "critical",
      })
    })

    it("should return high styling for FRP between 21 and 50", () => {
      const result = intensityStyle(30)
      expect(result).toEqual({
        dot: "bg-orange-500",
        text: "text-orange-500",
        label: "high",
      })
    })

    it("should return moderate styling for FRP <= 20", () => {
      const result = intensityStyle(15)
      expect(result).toEqual({
        dot: "bg-amber-400",
        text: "text-amber-500",
        label: "moderate",
      })
    })
  })

  describe("eaqiBand", () => {
    it("should place a concentration in the band its value falls into", () => {
      expect(eaqiBand("pm25", 5)?.label).toBe("Good")
      expect(eaqiBand("pm25", 15)?.label).toBe("Fair")
      expect(eaqiBand("pm25", 22)?.label).toBe("Moderate")
      expect(eaqiBand("pm25", 40)?.label).toBe("Poor")
      expect(eaqiBand("pm25", 60)?.label).toBe("Very poor")
      expect(eaqiBand("pm25", 900)?.label).toBe("Extremely poor")
    })

    it("should treat a breakpoint as the start of the next band", () => {
      expect(eaqiBand("pm25", 10)?.label).toBe("Fair")
      expect(eaqiBand("pm10", 20)?.label).toBe("Fair")
      expect(eaqiBand("no2", 40)?.label).toBe("Fair")
    })

    it("should use different breakpoints per pollutant", () => {
      expect(eaqiBand("pm25", 30)?.label).toBe("Poor")
      expect(eaqiBand("pm10", 30)?.label).toBe("Fair")
      expect(eaqiBand("no2", 30)?.label).toBe("Good")
    })

    it("should expose an ordered level so the worst pollutant can be picked", () => {
      expect(eaqiBand("pm25", 5)?.level).toBe(1)
      expect(eaqiBand("pm25", 900)?.level).toBe(6)
    })

    it("should return null for a missing reading rather than a colour", () => {
      expect(eaqiBand("pm25", null)).toBeNull()
      expect(eaqiBand("pm25", undefined)).toBeNull()
      expect(eaqiBand("pm25", Number.NaN)).toBeNull()
    })
  })

  describe("escHtml", () => {
    it("should escape special HTML characters to prevent XSS", () => {
      const input = `<script>alert("hello & welcome 'world'")</script>`
      const expected = `&lt;script&gt;alert(&quot;hello &amp; welcome &#x27;world&#x27;&quot;)&lt;/script&gt;`
      expect(escHtml(input)).toBe(expected)
    })

    it("should handle null and undefined safely by returning an empty string", () => {
      expect(escHtml(null)).toBe("")
      expect(escHtml(undefined)).toBe("")
    })

    it("should convert other data types like numbers to string representation", () => {
      expect(escHtml(123)).toBe("123")
    })
  })
})
