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

import { parseToRgba, rgba, transparentize } from "color2k"
import { describe, expect, it } from "vitest"

import { darkTheme, lightTheme } from "@streamlit/lib"
import { PageConfig } from "@streamlit/protobuf"

import {
  clampSidebarWidth,
  DEFAULT_WIDTH,
  getSidebarResizeHandleBackgroundImage,
  getSidebarResizeHandleHoverBorderColor,
  shouldCollapse,
} from "./utils"

const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 600

describe("shouldCollapse", () => {
  it("should collapse given state is collapsed", () => {
    expect(
      shouldCollapse(PageConfig.SidebarState.COLLAPSED, 50, 100)
    ).toBeTruthy()
  })

  it("should not collapse given state is expanded", () => {
    expect(
      shouldCollapse(PageConfig.SidebarState.EXPANDED, 50, 100)
    ).toBeFalsy()
  })

  it("should not collapse given state is locked and viewport is desktop-width", () => {
    // Wider than breakpoint — sidebar is pinned open
    expect(
      shouldCollapse(PageConfig.SidebarState.LOCKED, 500, 1200)
    ).toBeFalsy()
  })

  it("should collapse given state is locked and viewport is mobile-width", () => {
    // Narrower than breakpoint — lock degrades so the overlay sidebar doesn't trap users
    expect(
      shouldCollapse(PageConfig.SidebarState.LOCKED, 500, 400)
    ).toBeTruthy()
  })

  it("should collapse given state is auto and width is less than breakpoint", () => {
    const windowInnerWidth = 40
    expect(
      shouldCollapse(PageConfig.SidebarState.AUTO, 50, windowInnerWidth)
    ).toBeTruthy()
  })

  it("should not collapse given state is auto and width greater less than breakpoint", () => {
    const windowInnerWidth = 60
    expect(
      shouldCollapse(PageConfig.SidebarState.AUTO, 50, windowInnerWidth)
    ).toBeFalsy()
  })
})

describe("clampSidebarWidth", () => {
  describe("minimum width clamping", () => {
    it("should clamp values below minimum to 200px", () => {
      const testCases = [50, Number.NEGATIVE_INFINITY, Number.MIN_SAFE_INTEGER]

      testCases.forEach(width => {
        expect(clampSidebarWidth(width)).toBe(MIN_SIDEBAR_WIDTH)
      })
    })

    it("should handle exactly minimum width", () => {
      expect(clampSidebarWidth(MIN_SIDEBAR_WIDTH)).toBe(MIN_SIDEBAR_WIDTH)
    })
  })

  describe("maximum width clamping", () => {
    it("should clamp values above maximum to 600px", () => {
      const testCases = [
        1000,
        Number.POSITIVE_INFINITY,
        Number.MAX_SAFE_INTEGER,
      ]

      testCases.forEach(width => {
        expect(clampSidebarWidth(width)).toBe(MAX_SIDEBAR_WIDTH)
      })
    })

    it("should handle exactly maximum width", () => {
      expect(clampSidebarWidth(MAX_SIDEBAR_WIDTH)).toBe(MAX_SIDEBAR_WIDTH)
    })
  })

  describe("valid width range", () => {
    it("should return width unchanged when within valid bounds", () => {
      const validWidths = [300, 250.5]

      validWidths.forEach(width => {
        expect(clampSidebarWidth(width)).toBe(width)
      })
    })
  })

  describe("edge cases and error handling", () => {
    it("should handle boundary values correctly", () => {
      // Just below minimum
      expect(clampSidebarWidth(MIN_SIDEBAR_WIDTH - 1)).toBe(MIN_SIDEBAR_WIDTH)

      // Just above maximum
      expect(clampSidebarWidth(MAX_SIDEBAR_WIDTH + 1)).toBe(MAX_SIDEBAR_WIDTH)
    })

    it("should handle special numeric values", () => {
      // These should be handled gracefully by Math.max/Math.min
      expect(clampSidebarWidth(Number.NaN)).toBe(
        Number.parseInt(DEFAULT_WIDTH, 10)
      )
      expect(clampSidebarWidth(Number.MAX_VALUE)).toBe(MAX_SIDEBAR_WIDTH)
      expect(clampSidebarWidth(Number.MIN_VALUE)).toBe(MIN_SIDEBAR_WIDTH)
    })
  })
})

describe("getSidebarResizeHandleHoverBorderColor", () => {
  it("increases borderColor opacity by the documented step", () => {
    expect(
      getSidebarResizeHandleHoverBorderColor(transparentize("#000000", 0.8))
    ).toBe("rgba(0, 0, 0, 0.3)")
  })

  it("preserves the rgb of an opaque custom borderColor", () => {
    const borderColor = "#00008B"
    const [r, g, b] = parseToRgba(borderColor)

    expect(getSidebarResizeHandleHoverBorderColor(borderColor)).toBe(
      rgba(r, g, b, 1)
    )
  })

  it("clamps alpha at 1 for near-opaque custom borderColor", () => {
    const borderColor = "rgba(0, 0, 139, 0.95)"

    expect(
      parseToRgba(getSidebarResizeHandleHoverBorderColor(borderColor))[3]
    ).toBe(1)
  })

  it.each([
    ["light", lightTheme.emotion.colors.borderColor],
    ["dark", darkTheme.emotion.colors.borderColor],
  ] as const)(
    "uses the fadedText10 → fadedText20 alpha step for the default %s theme",
    (_name, borderColor) => {
      const [, , , alpha] = parseToRgba(borderColor)
      const [, , , hoverAlpha] = parseToRgba(
        getSidebarResizeHandleHoverBorderColor(borderColor)
      )

      expect(alpha).toBe(0.2)
      expect(hoverAlpha).toBe(0.3)
    }
  )
})

describe("getSidebarResizeHandleBackgroundImage", () => {
  it("uses a wider gradient fade on hover", () => {
    const borderColor = "#cccccc"

    expect(
      getSidebarResizeHandleBackgroundImage(borderColor, { isHovered: false })
    ).toContain("transparent 36%")
    expect(
      getSidebarResizeHandleBackgroundImage(borderColor, { isHovered: true })
    ).toContain("transparent 44%")
  })

  it("uses the provided borderColor in the gradient", () => {
    const hoverBorderColor = getSidebarResizeHandleHoverBorderColor(
      transparentize("#000000", 0.8)
    )

    expect(
      getSidebarResizeHandleBackgroundImage(hoverBorderColor, {
        isHovered: true,
      })
    ).toBe(
      `linear-gradient(to right, transparent 20%, ${hoverBorderColor} 28%, transparent 44%)`
    )
  })

  it("keeps the provided borderColor when building a rest gradient", () => {
    const borderColor = "#cccccc"

    expect(
      getSidebarResizeHandleBackgroundImage(borderColor, { isHovered: false })
    ).toBe(
      `linear-gradient(to right, transparent 20%, ${borderColor} 28%, transparent 36%)`
    )
  })
})
