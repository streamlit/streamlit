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

import { mockTheme } from "~lib/mocks/mockTheme"

import {
  applyStreamlitTheme,
  applyStreamlitThemeTemplateLayout,
  layoutWithThemeDefaults,
  replaceTemporaryColors,
} from "./CustomTheme"

const theme = mockTheme.emotion

describe("PlotlyChart CustomTheme", () => {
  describe("applyStreamlitThemeTemplateLayout", () => {
    it("applies streamlit theme to layout", () => {
      const layout = {}
      applyStreamlitThemeTemplateLayout(layout, theme)

      expect(layout).toEqual(
        expect.objectContaining({
          font: expect.objectContaining({
            color: expect.any(String),
            family: theme.genericFonts.bodyFont,
          }),
          paper_bgcolor: theme.colors.bgColor,
          plot_bgcolor: theme.colors.bgColor,
          xaxis: expect.objectContaining({
            showgrid: false,
            zeroline: false,
            automargin: true,
          }),
          yaxis: expect.objectContaining({
            automargin: true,
            ticklabelposition: "outside",
          }),
        })
      )
    })
  })

  describe("replaceTemporaryColors", () => {
    it("replaces categorical colors for streamlit theme", () => {
      // #000001 is CATEGORY_0
      const spec = JSON.stringify({ color: "#000001" })
      const result = replaceTemporaryColors(spec, theme, "streamlit")

      expect(result).toContain(theme.colors.chartCategoricalColors[0])
      expect(result).not.toContain("#000001")
    })

    it("replaces categorical colors for default theme", () => {
      const spec = JSON.stringify({ color: "#000001" })
      const result = replaceTemporaryColors(spec, theme, "default")

      // Default plotly color for CATEGORY_0 is #636efa
      expect(result).toContain("#636efa")
      expect(result).not.toContain("#000001")
    })

    it("replaces sequential colors", () => {
      // #000011 is SEQUENTIAL_0
      const spec = JSON.stringify({ color: "#000011" })
      const result = replaceTemporaryColors(spec, theme, "streamlit")

      expect(result).toContain(theme.colors.chartSequentialColors[0])
      expect(result).not.toContain("#000011")
    })

    it("replaces diverging colors", () => {
      // #000021 is DIVERGING_0
      const spec = JSON.stringify({ color: "#000021" })
      const result = replaceTemporaryColors(spec, theme, "streamlit")

      // We check if it replaced it with *something* different than the placeholder
      expect(result).not.toContain("#000021")
    })

    it("replaces GO specific colors", () => {
      // #000032 is INCREASING
      const spec = JSON.stringify({ color: "#000032" })
      const result = replaceTemporaryColors(spec, theme, "streamlit")

      // getIncreasingGreen(theme) -> usually equals theme.colors.green80 or similar logic
      expect(result).not.toContain("#000032")
    })
  })

  describe("applyStreamlitTheme", () => {
    it("applies theme to layout template and bolds title", () => {
      const spec = {
        layout: {
          title: {
            text: "My Chart",
          },
          template: {
            layout: {},
          },
        },
      }

      applyStreamlitTheme(spec, theme)

      expect(spec.layout.title.text).toBe("<b>My Chart</b>")
      // Verify that template.layout was modified with theme properties
      expect(spec.layout.template.layout).toHaveProperty("paper_bgcolor")
    })

    it("handles missing template gracefully", () => {
      const spec = {
        layout: {
          title: { text: "My Chart" },
          // missing template
        },
      }

      // Should not throw
      expect(() => applyStreamlitTheme(spec, theme)).not.toThrow()
    })
  })

  describe("layoutWithThemeDefaults", () => {
    it("applies defaults when properties are missing", () => {
      const layout = {}
      const result = layoutWithThemeDefaults(layout, theme)

      expect(result.font.family).toBe(theme.genericFonts.bodyFont)
      expect(result.paper_bgcolor).toBe(theme.colors.bgColor)
      expect(result.plot_bgcolor).toBe(theme.colors.secondaryBg)
    })

    it("preserves existing properties", () => {
      const layout = {
        font: { family: "Arial" },
        paper_bgcolor: "red",
      }
      const result = layoutWithThemeDefaults(layout, theme)

      expect(result.font.family).toBe("Arial")
      expect(result.paper_bgcolor).toBe("red")
      // Should still apply missing ones
      expect(result.plot_bgcolor).toBe(theme.colors.secondaryBg)
    })
  })
})
