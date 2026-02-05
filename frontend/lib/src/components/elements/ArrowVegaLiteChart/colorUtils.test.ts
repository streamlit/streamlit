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

import { EmotionTheme, lightTheme } from "~lib/theme"
import { resolveNamedColor } from "~lib/theme/getColors"
import { isNamedColor } from "~lib/theme/namedColors"

import { resolveNamedColorsInSpec } from "./colorUtils"

// Use the actual light theme for realistic color values
const mockTheme: EmotionTheme = lightTheme.emotion

describe("colorUtils", () => {
  describe("isNamedColor", () => {
    it.each([
      "red",
      "orange",
      "yellow",
      "green",
      "blue",
      "violet",
      "gray",
      "grey",
      "primary",
    ])('returns true for builtin color name "%s"', name => {
      expect(isNamedColor(name)).toBe(true)
    })

    it.each(["Red", "RED", "Blue", "GRAY", "Grey", "PRIMARY"])(
      'returns true for case-insensitive builtin color name "%s"',
      name => {
        expect(isNamedColor(name)).toBe(true)
      }
    )

    it.each([
      "#ff0000",
      "#f00",
      "rgb(255, 0, 0)",
      "notacolor",
      "pink",
      "cyan",
    ])('returns false for non-builtin color "%s"', value => {
      expect(isNamedColor(value)).toBe(false)
    })

    it.each([null, undefined, 123, [], {}])(
      "returns false for non-string value %p",
      value => {
        expect(isNamedColor(value)).toBe(false)
      }
    )
  })

  describe("resolveNamedColor", () => {
    it("resolves builtin color names to theme colors", () => {
      expect(resolveNamedColor("red", mockTheme)).toBe(
        mockTheme.colors.redColor
      )
      expect(resolveNamedColor("blue", mockTheme)).toBe(
        mockTheme.colors.blueColor
      )
      expect(resolveNamedColor("primary", mockTheme)).toBe(
        mockTheme.colors.primary
      )
    })

    it("handles grey/gray alias", () => {
      expect(resolveNamedColor("gray", mockTheme)).toBe(
        mockTheme.colors.grayColor
      )
      expect(resolveNamedColor("grey", mockTheme)).toBe(
        mockTheme.colors.grayColor
      )
    })

    it("is case-insensitive", () => {
      expect(resolveNamedColor("RED", mockTheme)).toBe(
        mockTheme.colors.redColor
      )
      expect(resolveNamedColor("Blue", mockTheme)).toBe(
        mockTheme.colors.blueColor
      )
    })

    it("returns non-builtin colors unchanged", () => {
      expect(resolveNamedColor("#ff0000", mockTheme)).toBe("#ff0000")
      expect(resolveNamedColor("rgb(255, 0, 0)", mockTheme)).toBe(
        "rgb(255, 0, 0)"
      )
      expect(resolveNamedColor("notacolor", mockTheme)).toBe("notacolor")
    })
  })

  describe("resolveNamedColorsInSpec", () => {
    it("resolves single color value in encoding", () => {
      const spec = {
        encoding: {
          color: { value: "red" },
        },
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      expect(spec.encoding.color.value).toBe(mockTheme.colors.redColor)
    })

    it("resolves color range in scale", () => {
      const spec = {
        encoding: {
          color: {
            scale: {
              range: ["red", "blue", "green"],
            },
          },
        },
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      expect(spec.encoding.color.scale.range).toEqual([
        mockTheme.colors.redColor,
        mockTheme.colors.blueColor,
        mockTheme.colors.greenColor,
      ])
    })

    it("resolves mixed builtin and hex colors in range", () => {
      const spec = {
        encoding: {
          color: {
            scale: {
              range: ["red", "#00ff00", "blue"],
            },
          },
        },
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      expect(spec.encoding.color.scale.range).toEqual([
        mockTheme.colors.redColor,
        "#00ff00",
        mockTheme.colors.blueColor,
      ])
    })

    it("resolves colors in layer specs (line_chart)", () => {
      const spec = {
        layer: [
          {
            mark: "line",
            encoding: {
              color: { value: "red" },
            },
          },
          {
            mark: "point",
            encoding: {
              color: { value: "blue" },
            },
          },
        ],
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      expect(
        (spec.layer[0] as Record<string, unknown>).encoding
      ).toMatchObject({
        color: { value: mockTheme.colors.redColor },
      })
      expect(
        (spec.layer[1] as Record<string, unknown>).encoding
      ).toMatchObject({
        color: { value: mockTheme.colors.blueColor },
      })
    })

    it("resolves colors in vconcat specs", () => {
      const spec = {
        vconcat: [
          {
            encoding: {
              color: { value: "red" },
            },
          },
          {
            encoding: {
              color: { value: "blue" },
            },
          },
        ],
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      expect(
        (spec.vconcat[0] as Record<string, unknown>).encoding
      ).toMatchObject({
        color: { value: mockTheme.colors.redColor },
      })
      expect(
        (spec.vconcat[1] as Record<string, unknown>).encoding
      ).toMatchObject({
        color: { value: mockTheme.colors.blueColor },
      })
    })

    it("resolves colors in hconcat specs", () => {
      const spec = {
        hconcat: [
          {
            encoding: {
              color: { value: "orange" },
            },
          },
          {
            encoding: {
              color: { value: "violet" },
            },
          },
        ],
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      expect(
        (spec.hconcat[0] as Record<string, unknown>).encoding
      ).toMatchObject({
        color: { value: mockTheme.colors.orangeColor },
      })
      expect(
        (spec.hconcat[1] as Record<string, unknown>).encoding
      ).toMatchObject({
        color: { value: mockTheme.colors.violetColor },
      })
    })

    it("resolves colors in facet specs", () => {
      // Facet spec structure: { facet: {...}, spec: {encoding...} }
      // See: https://vega.github.io/vega-lite/docs/facet.html
      const spec = {
        facet: {
          column: { field: "category", type: "nominal" },
        },
        spec: {
          mark: "bar",
          encoding: {
            x: { field: "x", type: "quantitative" },
            y: { field: "y", type: "quantitative" },
            color: { value: "green" },
          },
        },
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      expect((spec.spec as Record<string, unknown>).encoding).toMatchObject({
        color: { value: mockTheme.colors.greenColor },
      })
    })

    it("resolves colors in repeat specs", () => {
      // Repeat spec structure: { repeat: {...}, spec: {encoding...} }
      // See: https://vega.github.io/vega-lite/docs/repeat.html
      const spec = {
        repeat: {
          column: ["field1", "field2"],
        },
        spec: {
          mark: "point",
          encoding: {
            x: { field: { repeat: "column" }, type: "quantitative" },
            y: { field: "y", type: "quantitative" },
            color: { value: "blue" },
          },
        },
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      expect((spec.spec as Record<string, unknown>).encoding).toMatchObject({
        color: { value: mockTheme.colors.blueColor },
      })
    })

    it("resolves colors in nested facet with layers", () => {
      // Complex case: facet with layered spec
      const spec = {
        facet: {
          row: { field: "category", type: "nominal" },
        },
        spec: {
          layer: [
            {
              mark: "line",
              encoding: {
                color: { value: "red" },
              },
            },
            {
              mark: "point",
              encoding: {
                color: { value: "orange" },
              },
            },
          ],
        },
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      const innerSpec = spec.spec as Record<string, unknown>
      const layers = innerSpec.layer as Array<Record<string, unknown>>

      expect(layers[0].encoding).toMatchObject({
        color: { value: mockTheme.colors.redColor },
      })
      expect(layers[1].encoding).toMatchObject({
        color: { value: mockTheme.colors.orangeColor },
      })
    })

    it("resolves colors in nested layers", () => {
      // Nested layers are valid in Vega-Lite
      const spec = {
        layer: [
          {
            layer: [
              {
                mark: "line",
                encoding: {
                  color: { value: "red" },
                },
              },
              {
                mark: "point",
                encoding: {
                  color: { value: "blue" },
                },
              },
            ],
          },
          {
            mark: "area",
            encoding: {
              color: { value: "green" },
            },
          },
        ],
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      const outerLayers = spec.layer as Array<Record<string, unknown>>
      const innerLayers = outerLayers[0].layer as Array<
        Record<string, unknown>
      >

      // Check nested layer colors
      expect(innerLayers[0].encoding).toMatchObject({
        color: { value: mockTheme.colors.redColor },
      })
      expect(innerLayers[1].encoding).toMatchObject({
        color: { value: mockTheme.colors.blueColor },
      })

      // Check outer layer color
      expect(outerLayers[1].encoding).toMatchObject({
        color: { value: mockTheme.colors.greenColor },
      })
    })

    it("resolves colors in deeply nested compositions", () => {
      // vconcat containing hconcat containing layers
      const spec = {
        vconcat: [
          {
            hconcat: [
              {
                layer: [
                  {
                    encoding: { color: { value: "red" } },
                  },
                ],
              },
            ],
          },
        ],
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      const vconcat = spec.vconcat as Array<Record<string, unknown>>
      const hconcat = vconcat[0].hconcat as Array<Record<string, unknown>>
      const layer = hconcat[0].layer as Array<Record<string, unknown>>

      expect(layer[0].encoding).toMatchObject({
        color: { value: mockTheme.colors.redColor },
      })
    })

    it("leaves non-builtin colors unchanged", () => {
      const spec = {
        encoding: {
          color: { value: "#ff0000" },
        },
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      expect(spec.encoding.color.value).toBe("#ff0000")
    })

    it("handles spec without color encoding", () => {
      const spec = {
        encoding: {
          x: { field: "a" },
          y: { field: "b" },
        },
      }

      // Should not throw
      expect(() => resolveNamedColorsInSpec(spec, mockTheme)).not.toThrow()
    })

    it("handles spec without encoding", () => {
      const spec = {
        mark: "bar",
      }

      // Should not throw
      expect(() => resolveNamedColorsInSpec(spec, mockTheme)).not.toThrow()
    })

    it("resolves primary color", () => {
      const spec = {
        encoding: {
          color: { value: "primary" },
        },
      }

      resolveNamedColorsInSpec(spec, mockTheme)

      expect(spec.encoding.color.value).toBe(mockTheme.colors.primary)
    })
  })
})
