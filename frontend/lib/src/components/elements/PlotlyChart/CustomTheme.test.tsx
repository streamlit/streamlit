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
import { getGray70 } from "~lib/theme/getColors"

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

    it("scrubs sankey template textfont.color when user set layout.font.color", () => {
      // Reproduces https://github.com/streamlit/streamlit/issues/11031:
      // fig.update_layout(font=dict(color="red")) must survive the Streamlit
      // theme merge and win over Sankey's template `textfont.color` default.
      // The realistic template shape only injects `textfont.color` (no
      // `.family`) — see `streamlit_plotly_theme.py`.
      const spec = {
        layout: {
          font: { family: "Times New Roman", color: "red", size: 18 },
          template: {
            layout: {},
            data: {
              sankey: [{ textfont: { color: getGray70(theme) } }],
            },
          },
        },
      }

      applyStreamlitTheme(spec, theme)

      // User's layout.font is untouched.
      expect(spec.layout.font).toEqual({
        family: "Times New Roman",
        color: "red",
        size: 18,
      })
      // The shadowing Streamlit default is removed so the user's color wins.
      expect(spec.layout.template.data.sankey[0].textfont).not.toHaveProperty(
        "color"
      )
    })

    it("scrubs icicle template textfont.color when user set layout.font.color", () => {
      const spec = {
        layout: {
          font: { color: "red" },
          template: {
            layout: {},
            data: {
              icicle: [{ textfont: { color: "white" } }],
            },
          },
        },
      }

      applyStreamlitTheme(spec, theme)

      expect(spec.layout.template.data.icicle[0].textfont).not.toHaveProperty(
        "color"
      )
    })

    it("leaves template textfont alone when user did not set font", () => {
      const spec = {
        layout: {
          template: {
            layout: {},
            data: {
              sankey: [{ textfont: { color: getGray70(theme) } }],
            },
          },
        },
      }

      applyStreamlitTheme(spec, theme)

      // Without a user-provided layout.font, the theme's Sankey textfont color
      // must still be respected so charts pick up the Streamlit theme colors.
      expect(spec.layout.template.data.sankey[0].textfont.color).toBe(
        getGray70(theme)
      )
    })

    it("does not scrub template textfont when only layout.font.family is set", () => {
      // Streamlit does not inject `textfont.family` on any trace type, so
      // `layout.font.family` inherits via Plotly's normal cascade; the
      // frontend does not need to touch the template.
      const sankeyColor = getGray70(theme)
      const spec = {
        layout: {
          font: { family: "Times New Roman" },
          template: {
            layout: {},
            data: {
              sankey: [{ textfont: { color: sankeyColor } }],
            },
          },
        },
      }

      applyStreamlitTheme(spec, theme)

      expect(spec.layout.template.data.sankey[0].textfont.color).toBe(
        sankeyColor
      )
    })

    it("preserves user-owned custom sankey template textfont.color under theme=streamlit", () => {
      // A user-supplied custom Plotly template may define its own `sankey`
      // trace with a `textfont.color` that differs from Streamlit's injected
      // default. In that case the user's color must win — matching Plotly's
      // standard template precedence and `fig.show()`. Only Streamlit's own
      // injected default (getGray70(theme)) is scrubbed.
      const spec = {
        layout: {
          font: { color: "red" },
          template: {
            layout: {},
            data: {
              sankey: [
                { textfont: { color: "#ABCDEF", family: "CustomFam" } },
              ],
            },
          },
        },
      }

      applyStreamlitTheme(spec, theme)

      // Custom textfont is preserved verbatim.
      expect(spec.layout.template.data.sankey[0].textfont).toEqual({
        color: "#ABCDEF",
        family: "CustomFam",
      })
    })

    it("preserves user-owned custom icicle template textfont.color under theme=streamlit", () => {
      const spec = {
        layout: {
          font: { color: "red" },
          template: {
            layout: {},
            data: {
              icicle: [{ textfont: { color: "#123456" } }],
            },
          },
        },
      }

      applyStreamlitTheme(spec, theme)

      expect(spec.layout.template.data.icicle[0].textfont).toEqual({
        color: "#123456",
      })
    })

    it("preserves textfont on non-Streamlit-owned custom template traces", () => {
      // Trace types outside the Streamlit-owned set (scatter, bar, ...) must
      // always have their custom `textfont` preserved, even when the user
      // sets `layout.font`.
      const spec = {
        layout: {
          font: { family: "Times New Roman", color: "red" },
          template: {
            layout: {},
            data: {
              scatter: [
                { textfont: { family: "CustomFamily", color: "CustomColor" } },
              ],
              bar: [
                { textfont: { family: "CustomFamily", color: "CustomColor" } },
              ],
              // Streamlit-owned trace with the injected default color — this
              // one should still be scrubbed.
              sankey: [{ textfont: { color: getGray70(theme) } }],
            },
          },
        },
      }

      applyStreamlitTheme(spec, theme)

      expect(spec.layout.template.data.scatter[0].textfont).toEqual({
        family: "CustomFamily",
        color: "CustomColor",
      })
      expect(spec.layout.template.data.bar[0].textfont).toEqual({
        family: "CustomFamily",
        color: "CustomColor",
      })
      expect(spec.layout.template.data.sankey[0].textfont).not.toHaveProperty(
        "color"
      )
    })
  })

  describe("layoutWithThemeDefaults", () => {
    it("applies defaults when properties are missing", () => {
      const layout = {}
      const result = layoutWithThemeDefaults(layout, theme)

      expect((result.font as Record<string, unknown>).family).toBe(
        theme.genericFonts.bodyFont
      )
      expect(result.paper_bgcolor).toBe(theme.colors.bgColor)
      expect(result.plot_bgcolor).toBe(theme.colors.secondaryBg)
    })

    it("preserves existing properties", () => {
      const layout = {
        font: { family: "Arial" },
        paper_bgcolor: "red",
      }
      const result = layoutWithThemeDefaults(layout, theme)

      expect((result.font as Record<string, unknown>).family).toBe("Arial")
      expect(result.paper_bgcolor).toBe("red")
      // Should still apply missing ones
      expect(result.plot_bgcolor).toBe(theme.colors.secondaryBg)
    })
  })
})
