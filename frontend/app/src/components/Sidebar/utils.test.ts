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

import { describe, expect, it } from "vitest"

import { PageConfig } from "@streamlit/protobuf"

import { clampSidebarWidth, DEFAULT_WIDTH, shouldCollapse } from "./utils"

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
