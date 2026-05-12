/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  darken,
  getLuminance,
  lighten,
  mix,
  parseToRgba,
  setAlpha,
  toHex,
} from "./colorUtils"

describe("colorUtils", () => {
  describe("setAlpha", () => {
    it("sets alpha on opaque hex color", () => {
      expect(setAlpha("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)")
    })

    it("sets alpha on opaque rgb color", () => {
      expect(setAlpha("rgb(0, 255, 0)", 0.3)).toBe("rgba(0, 255, 0, 0.3)")
    })

    it("replaces existing alpha on rgba color", () => {
      expect(setAlpha("rgba(0, 0, 255, 0.8)", 0.2)).toBe(
        "rgba(0, 0, 255, 0.2)"
      )
    })

    it("sets alpha to 0 (fully transparent)", () => {
      expect(setAlpha("#ffffff", 0)).toBe("rgba(255, 255, 255, 0)")
    })

    it("sets alpha to 1 (fully opaque) returns hex", () => {
      expect(setAlpha("rgba(100, 100, 100, 0.5)", 1)).toBe("#646464")
    })

    it("returns original color for unsupported format (hwb)", () => {
      expect(setAlpha("hwb(120 0% 0%)", 0.5)).toBe("hwb(120 0% 0%)")
    })

    it("handles named colors", () => {
      expect(setAlpha("red", 0.5)).toBe("rgba(255, 0, 0, 0.5)")
    })

    it("clamps alpha values greater than 1 to 1", () => {
      expect(setAlpha("#ff0000", 1.5)).toBe("#ff0000")
    })

    it("clamps negative alpha values to 0", () => {
      expect(setAlpha("#ff0000", -0.5)).toBe("rgba(255, 0, 0, 0)")
    })
  })

  describe("darken", () => {
    it("darkens a color by default amount", () => {
      const result = darken("#ffffff")
      expect(result).not.toBe("#ffffff")
      const lum = getLuminance(result)
      expect(lum).toBeLessThan(1)
    })

    it("darkens a color by specified amount", () => {
      const result = darken("#808080", 0.2)
      const originalLum = getLuminance("#808080")
      const resultLum = getLuminance(result)
      expect(resultLum).toBeLessThan(originalLum)
    })

    it("returns original color for unsupported format", () => {
      expect(darken("hwb(120 0% 0%)", 0.1)).toBe("hwb(120 0% 0%)")
    })
  })

  describe("lighten", () => {
    it("lightens a color by default amount", () => {
      const result = lighten("#000000")
      expect(result).not.toBe("#000000")
      const lum = getLuminance(result)
      expect(lum).toBeGreaterThan(0)
    })

    it("lightens a color by specified amount", () => {
      const result = lighten("#808080", 0.2)
      const originalLum = getLuminance("#808080")
      const resultLum = getLuminance(result)
      expect(resultLum).toBeGreaterThan(originalLum)
    })

    it("returns original color for unsupported format", () => {
      expect(lighten("hwb(120 0% 0%)", 0.1)).toBe("hwb(120 0% 0%)")
    })
  })

  describe("mix", () => {
    it("mixes two colors equally by default", () => {
      const result = mix("#ff0000", "#0000ff")
      expect(result).toBe("#800080")
    })

    it("mixes with ratio favoring first color", () => {
      const result = mix("#ff0000", "#0000ff", 0.25)
      expect(result).toBe("#bf0040")
    })

    it("mixes with ratio favoring second color", () => {
      const result = mix("#ff0000", "#0000ff", 0.75)
      expect(result).toBe("#4000bf")
    })

    it("returns first color if second is unsupported", () => {
      expect(mix("#ff0000", "hwb(240 0% 0%)", 0.5)).toBe("#ff0000")
    })

    it("returns first color if first is unsupported", () => {
      expect(mix("hwb(0 0% 0%)", "#0000ff", 0.5)).toBe("hwb(0 0% 0%)")
    })
  })

  describe("getLuminance", () => {
    it("returns 1 for white", () => {
      expect(getLuminance("#ffffff")).toBe(1)
    })

    it("returns 0 for black", () => {
      expect(getLuminance("#000000")).toBe(0)
    })

    it("returns value between 0 and 1 for gray", () => {
      const lum = getLuminance("#808080")
      expect(lum).toBeGreaterThan(0)
      expect(lum).toBeLessThan(1)
    })

    it("returns 0.5 fallback for unsupported format", () => {
      expect(getLuminance("hwb(120 0% 0%)")).toBe(0.5)
    })
  })

  describe("parseToRgba", () => {
    it("parses hex color", () => {
      expect(parseToRgba("#ff0000")).toEqual([255, 0, 0, 1])
    })

    it("parses rgb color", () => {
      expect(parseToRgba("rgb(0, 255, 0)")).toEqual([0, 255, 0, 1])
    })

    it("parses rgba color", () => {
      expect(parseToRgba("rgba(0, 0, 255, 0.5)")).toEqual([0, 0, 255, 0.5])
    })

    it("parses named color", () => {
      expect(parseToRgba("blue")).toEqual([0, 0, 255, 1])
    })

    it("returns null for invalid color", () => {
      expect(parseToRgba("not-a-color")).toBeNull()
    })

    it("returns null for unsupported format (hwb)", () => {
      expect(parseToRgba("hwb(120 0% 0%)")).toBeNull()
    })
  })

  describe("toHex", () => {
    it("converts rgb to hex", () => {
      expect(toHex("rgb(255, 0, 0)")).toBe("#ff0000")
    })

    it("converts rgba with alpha 1 to 6-digit hex", () => {
      expect(toHex("rgba(0, 255, 0, 1)")).toBe("#00ff00")
    })

    it("converts rgba with alpha < 1 to 8-digit hex", () => {
      expect(toHex("rgba(0, 0, 255, 0.5)")).toBe("#0000ff80")
    })

    it("converts named color to hex", () => {
      expect(toHex("red")).toBe("#ff0000")
    })

    it("returns original color for invalid color", () => {
      expect(toHex("not-a-color")).toBe("not-a-color")
    })

    it("returns original color for unsupported format (hwb)", () => {
      expect(toHex("hwb(120 0% 0%)")).toBe("hwb(120 0% 0%)")
    })
  })
})
