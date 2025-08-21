/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { darkTheme, lightTheme } from "~lib/theme/index"

import { getDividerColors, hasLightBackgroundColor } from "./getColors"

describe("getDividerColors", () => {
  describe("light theme", () => {
    it("returns correct default divider colors for light theme", () => {
      expect(hasLightBackgroundColor(lightTheme.emotion)).toBe(true)
      const result = getDividerColors(lightTheme.emotion)

      expect(result).toEqual({
        red: "#ff4b4b",
        orange: "#ffa421",
        yellow: "#faca2b",
        blue: "#1c83e1",
        green: "#21c354",
        violet: "#803df5",
        gray: "#d5dae5",
        grey: "#d5dae5",
        rainbow:
          "linear-gradient(to right, #ff4b4b, #ffa421, #faca2b, #21c354, #1c83e1, #803df5)",
      })
    })

    it("has all required color properties", () => {
      const result = getDividerColors(lightTheme.emotion)

      expect(result).toHaveProperty("red")
      expect(result).toHaveProperty("orange")
      expect(result).toHaveProperty("yellow")
      expect(result).toHaveProperty("blue")
      expect(result).toHaveProperty("green")
      expect(result).toHaveProperty("violet")
      expect(result).toHaveProperty("gray")
      expect(result).toHaveProperty("grey")
      expect(result).toHaveProperty("rainbow")

      // Verify all colors are valid hex strings
      Object.entries(result).forEach(([key, value]) => {
        if (key !== "rainbow") {
          expect(value).toMatch(/^#[0-9a-fA-F]{6}$/)
        }
      })
    })

    it("gray and grey properties are identical", () => {
      const result = getDividerColors(lightTheme.emotion)
      expect(result.gray).toBe(result.grey)
    })

    it("rainbow gradient contains all color values", () => {
      const result = getDividerColors(lightTheme.emotion)

      expect(result.rainbow).toBe(
        "linear-gradient(to right, #ff4b4b, #ffa421, #faca2b, #21c354, #1c83e1, #803df5)"
      )
    })
  })

  describe("dark theme", () => {
    it("returns correct default divider colors for dark theme", () => {
      expect(hasLightBackgroundColor(darkTheme.emotion)).toBe(false)
      const result = getDividerColors(darkTheme.emotion)

      expect(result).toEqual({
        red: "#ff2b2b",
        orange: "#ff8700",
        yellow: "#ffe312",
        blue: "#0068c9",
        green: "#09ab3b",
        violet: "#803df5",
        gray: "#555867",
        grey: "#555867",
        rainbow:
          "linear-gradient(to right, #ff2b2b, #ff8700, #ffe312, #09ab3b, #0068c9, #803df5)",
      })
    })

    it("has all required color properties", () => {
      const result = getDividerColors(darkTheme.emotion)

      expect(result).toHaveProperty("red")
      expect(result).toHaveProperty("orange")
      expect(result).toHaveProperty("yellow")
      expect(result).toHaveProperty("blue")
      expect(result).toHaveProperty("green")
      expect(result).toHaveProperty("violet")
      expect(result).toHaveProperty("gray")
      expect(result).toHaveProperty("grey")
      expect(result).toHaveProperty("rainbow")

      // Verify all colors are valid hex strings
      Object.entries(result).forEach(([key, value]) => {
        if (key !== "rainbow") {
          expect(value).toMatch(/^#[0-9a-fA-F]{6}$/)
        }
      })
    })

    it("gray and grey properties are identical", () => {
      const result = getDividerColors(darkTheme.emotion)
      expect(result.gray).toBe(result.grey)
    })

    it("rainbow gradient contains all color values", () => {
      const result = getDividerColors(darkTheme.emotion)

      expect(result.rainbow).toBe(
        "linear-gradient(to right, #ff2b2b, #ff8700, #ffe312, #09ab3b, #0068c9, #803df5)"
      )
    })
  })
})
