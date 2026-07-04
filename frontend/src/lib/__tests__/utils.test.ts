import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("lib/utils cn helper", () => {
  it("should merge simple class names", () => {
    expect(cn("px-2", "py-2")).toBe("px-2 py-2")
  })

  it("should handle conditional class names", () => {
    expect(cn("px-2", false && "py-2", true && "text-red-500")).toBe("px-2 text-red-500")
  })

  it("should merge tailwind conflicts correctly", () => {
    expect(cn("px-2 px-4")).toBe("px-4")
    expect(cn("p-2", "p-4")).toBe("p-4")
  })

  it("should handle empty values and undefined safely", () => {
    expect(cn("p-2", undefined, null, "")).toBe("p-2")
  })
})
