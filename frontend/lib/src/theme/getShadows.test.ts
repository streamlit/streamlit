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

import { beforeAll, describe, expect, it } from "vitest"

import { mockTheme } from "~lib/mocks/mockTheme"
import { darkTheme } from "~lib/theme"

import { createShadows, ThemeShadows } from "./getShadows"

// Use mockTheme colors for light theme tests (has white bgColor)
const lightThemeColors = mockTheme.emotion.colors

// Use darkTheme colors for dark theme tests
const darkThemeColors = darkTheme.emotion.colors

describe("createShadows", () => {
  describe("with light background (mockTheme)", () => {
    let shadows: ThemeShadows

    beforeAll(() => {
      shadows = createShadows(lightThemeColors)
    })

    it("returns light elevation shadows", () => {
      // Light theme uses lower opacity values (0.08-0.16)
      expect(shadows.tooltip).toBe("0px 1px 4px rgba(0, 0, 0, 0.16)")
      expect(shadows.popover).toBe("0px 4px 16px rgba(0, 0, 0, 0.16)")
      expect(shadows.toolbar).toBe("1px 2px 8px rgba(0, 0, 0, 0.08)")
      expect(shadows.sidebar).toBe("-2rem 0 2rem 2rem rgba(0, 0, 0, 0.16)")
    })

    it("computes focus ring shadows from colors", () => {
      // Primary focus ring uses primary color with 0.5 alpha
      expect(shadows.focusRing).toBe("0 0 0 0.2rem rgba(255, 75, 75, 0.5)")
      // Subtle focus ring uses darkenedBgMix25 with 0.5 alpha
      expect(shadows.focusRingSubtle).toMatch(/^0 0 0 0\.2rem rgba\(/)
      // Outline focus ring - solid 1px outline
      expect(shadows.focusRingOutline).toBe("0 0 0 1px #ff4b4b")
      // Muted focus ring uses gray90 with 0.8 alpha (0.2 opacity)
      expect(shadows.focusRingMuted).toBe("0 0 0 0.2rem rgba(38, 39, 48, 0.2)")
    })

    it("includes none shadow for reset", () => {
      expect(shadows.none).toBe("none")
    })
  })

  describe("with dark background (darkTheme)", () => {
    let shadows: ThemeShadows

    beforeAll(() => {
      shadows = createShadows(darkThemeColors)
    })

    it("returns dark elevation shadows", () => {
      // Dark theme uses higher opacity values (0.2-0.7)
      expect(shadows.tooltip).toBe("0px 1px 4px rgba(0, 0, 0, 0.4)")
      expect(shadows.popover).toBe("0px 4px 16px rgba(0, 0, 0, 0.7)")
      expect(shadows.toolbar).toBe("1px 2px 8px rgba(0, 0, 0, 0.2)")
      expect(shadows.sidebar).toBe("-2rem 0 2rem 2rem rgba(0, 0, 0, 0.4)")
    })

    it("computes focus ring shadows from colors", () => {
      // Primary focus ring uses same primary color
      expect(shadows.focusRing).toBe("0 0 0 0.2rem rgba(255, 75, 75, 0.5)")
      // Subtle focus ring uses darkenedBgMix25 with 0.5 alpha
      expect(shadows.focusRingSubtle).toMatch(/^0 0 0 0\.2rem rgba\(/)
      // Outline focus ring - same across themes
      expect(shadows.focusRingOutline).toBe("0 0 0 1px #ff4b4b")
      // Muted focus ring uses gray10 with 0.8 alpha (0.2 opacity)
      expect(shadows.focusRingMuted).toBe(
        "0 0 0 0.2rem rgba(250, 250, 250, 0.2)"
      )
    })

    it("includes none shadow for reset", () => {
      expect(shadows.none).toBe("none")
    })
  })

  describe("luminance-based elevation shadow selection", () => {
    it("uses light shadows when bgColor luminance > 0.5", () => {
      // Test various light backgrounds
      const lightBgs = ["#ffffff", "#f0f0f0", "#e0e0e0", "#d0d0d0"]

      lightBgs.forEach(bgColor => {
        const shadows = createShadows({
          ...lightThemeColors,
          bgColor,
        })
        // Light theme shadows have lower opacity
        expect(shadows.tooltip).toContain("0.16")
      })
    })

    it("uses dark shadows when bgColor luminance <= 0.5", () => {
      // Test various dark backgrounds
      const darkBgs = ["#000000", "#0e1117", "#1a1a1a", "#2a2a2a"]

      darkBgs.forEach(bgColor => {
        const shadows = createShadows({
          ...darkThemeColors,
          bgColor,
        })
        // Dark theme shadows have higher opacity
        expect(shadows.tooltip).toContain("0.4")
      })
    })

    it("correctly handles the boundary luminance (~0.5)", () => {
      // Note: Luminance is calculated using relative luminance formula,
      // not simple brightness. Gray colors have lower luminance than expected.

      // #bdbdbd has luminance ~0.51 (above threshold) -> light shadows
      const lightGrayShadows = createShadows({
        ...lightThemeColors,
        bgColor: "#bdbdbd", // luminance ~0.51
      })
      expect(lightGrayShadows.tooltip).toContain("0.16")

      // #b8b8b8 has luminance ~0.48 (below threshold) -> dark shadows
      const darkGrayShadows = createShadows({
        ...darkThemeColors,
        bgColor: "#b8b8b8", // luminance ~0.48
      })
      expect(darkGrayShadows.tooltip).toContain("0.4")
    })
  })

  describe("custom primary colors", () => {
    it("uses custom primary color for focus ring shadows", () => {
      const customColors = {
        ...lightThemeColors,
        primary: "#00ff00", // green
      }

      const shadows = createShadows(customColors)

      // Focus ring should use the custom green color
      expect(shadows.focusRing).toContain("rgba(0, 255, 0")
      expect(shadows.focusRingOutline).toBe("0 0 0 1px #00ff00")
    })

    it("uses custom primary color for focus ring regardless of background", () => {
      const customLightTheme = createShadows({
        ...lightThemeColors,
        primary: "#0000ff", // blue
      })

      const customDarkTheme = createShadows({
        ...darkThemeColors,
        primary: "#0000ff", // blue
      })

      // Both should use the same blue primary for focus rings
      expect(customLightTheme.focusRing).toContain("rgba(0, 0, 255")
      expect(customDarkTheme.focusRing).toContain("rgba(0, 0, 255")
      expect(customLightTheme.focusRingOutline).toBe("0 0 0 1px #0000ff")
      expect(customDarkTheme.focusRingOutline).toBe("0 0 0 1px #0000ff")
    })
  })

  describe("shadow structure", () => {
    it("returns all required shadow keys", () => {
      const shadows = createShadows(lightThemeColors)

      const requiredKeys = [
        "tooltip",
        "popover",
        "toolbar",
        "sidebar",
        "focusRing",
        "focusRingSubtle",
        "focusRingOutline",
        "focusRingMuted",
        "none",
      ]

      requiredKeys.forEach(key => {
        expect(shadows).toHaveProperty(key)
      })
    })

    it("light and dark backgrounds produce shadows with identical keys", () => {
      const lightShadows = createShadows(lightThemeColors)
      const darkShadows = createShadows(darkThemeColors)

      expect(Object.keys(lightShadows).sort()).toEqual(
        Object.keys(darkShadows).sort()
      )
    })

    it("returns valid CSS box-shadow strings for all shadows", () => {
      const shadows = createShadows(lightThemeColors)

      Object.values(shadows).forEach(shadow => {
        expect(typeof shadow).toBe("string")
        expect(shadow.length).toBeGreaterThan(0)
        // Each shadow should be either "none", contain a hex color, or contain rgba
        expect(
          shadow === "none" || shadow.includes("#") || shadow.includes("rgba(")
        ).toBe(true)
      })
    })
  })
})
