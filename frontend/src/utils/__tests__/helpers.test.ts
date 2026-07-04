import { intensityStyle, escHtml } from "@/utils/helpers"

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
