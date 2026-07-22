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

import { renderHook } from "~lib/components/shared/ElementFullscreen/testUtils"
import { lightTheme } from "~lib/theme/themeConfigs"

import { VegaLiteChartElement } from "./arrowUtils"
import { useVegaElementPreprocessor } from "./useVegaElementPreprocessor"

type VegaLiteSpec = {
  title?: string | { text: string; limit?: number }
  [key: string]: unknown
}

type VegaLiteSpecWithDimensions = VegaLiteSpec & {
  width?: number
  height?: number
}

const getElement = (
  elementProps: Partial<VegaLiteChartElement> = {}
): VegaLiteChartElement => ({
  data: null,
  id: "1",
  useContainerWidth: false,
  datasets: [],
  selectionMode: [],
  formId: "",
  spec: JSON.stringify({
    data: {
      values: [
        { category: "A", group: "x", value: 0.1 },
        { category: "A", group: "y", value: 0.6 },
        { category: "A", group: "z", value: 0.9 },
        { category: "B", group: "x", value: 0.7 },
        { category: "B", group: "y", value: 0.2 },
        { category: "B", group: "z", value: 1.1 },
        { category: "C", group: "x", value: 0.6 },
        { category: "C", group: "y", value: 0.1 },
        { category: "C", group: "z", value: 0.2 },
      ],
    },
    mark: "bar",
    encoding: {
      x: { field: "category" },
      y: { field: "value", type: "quantitative" },
    },
  }),
  vegaLiteTheme: "streamlit",
  ...elementProps,
})

describe("useVegaElementPreprocessor", () => {
  const containerWidth = 100
  const containerHeight = 100
  const useContainerWidth = false
  const useContainerHeight = false

  it("renders the same selectionMode even if reference changes", () => {
    const { result, rerender } = renderHook(
      (element: VegaLiteChartElement) =>
        useVegaElementPreprocessor(
          element,
          containerWidth,
          containerHeight,
          useContainerWidth,
          useContainerHeight
        ),
      {
        initialProps: getElement({
          selectionMode: ["single"],
        }),
      }
    )

    const { selectionMode } = result.current

    rerender(
      getElement({
        selectionMode: ["single"],
      })
    )

    expect(result.current.selectionMode).toBe(selectionMode)
  })

  it("renders the same spec even if reference changes", () => {
    const { result, rerender } = renderHook(
      (element: VegaLiteChartElement) =>
        useVegaElementPreprocessor(
          element,
          containerWidth,
          containerHeight,
          useContainerWidth,
          useContainerHeight
        ),
      {
        initialProps: getElement(),
      }
    )

    const { spec } = result.current

    rerender(getElement())

    expect(result.current.spec).toBe(spec)
  })

  it("updates the spec if factors cause it to change (like sizing, theme, selection mode, and spec)", () => {
    const { result, rerender } = renderHook(
      ({
        element,
        containerWidth: width,
        containerHeight: height,
        useContainerWidth: useWidth,
        useContainerHeight: useHeight,
      }: {
        element: VegaLiteChartElement
        containerWidth: number
        containerHeight: number
        useContainerWidth: boolean
        useContainerHeight: boolean
      }) =>
        useVegaElementPreprocessor(
          element,
          width,
          height,
          useWidth,
          useHeight
        ),
      {
        initialProps: {
          element: getElement(),
          containerWidth,
          containerHeight,
          useContainerWidth,
          useContainerHeight,
        },
      }
    )

    let { spec } = result.current

    // Test changes that should trigger spec updates
    const changes = [
      // Change hook parameters
      {
        element: getElement({ useContainerWidth: true }),
        containerWidth,
        containerHeight,
        useContainerWidth: true, // This should cause spec change
        useContainerHeight,
      },
      // Change element properties
      {
        element: getElement({ vegaLiteTheme: undefined }),
        containerWidth,
        containerHeight,
        useContainerWidth: true,
        useContainerHeight,
      },
      {
        element: getElement({ selectionMode: ["single"] }),
        containerWidth,
        containerHeight,
        useContainerWidth: true,
        useContainerHeight,
      },
      {
        element: getElement({ spec: "{}" }),
        containerWidth,
        containerHeight,
        useContainerWidth: true,
        useContainerHeight,
      },
    ]

    for (const change of changes) {
      rerender(change)

      expect(result.current.spec).not.toBe(spec)

      // Save the last spec to compare with the next one
      spec = result.current.spec
    }
  })

  describe("spec.title.limit", () => {
    it("should not have title property if spec has no title", () => {
      const { result } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(
            element,
            containerWidth,
            containerHeight,
            useContainerWidth,
            useContainerHeight
          ),
        {
          initialProps: getElement({
            spec: JSON.stringify({
              mark: "bar",
            }),
          }),
        }
      )
      expect(
        (result.current.spec as unknown as VegaLiteSpec).title
      ).toBeUndefined()
    })

    it.each([
      {
        testName: "should set title.limit when title is a string",
        spec: { title: "My Chart", mark: "bar" },
        containerWidth: 100,
        expectedLimit: 60,
        expectedText: "My Chart",
      },
      {
        testName: "should set title.limit when title is an object",
        spec: { title: { text: "My Chart" }, mark: "bar" },
        containerWidth: 100,
        expectedLimit: 60,
        expectedText: "My Chart",
      },
      {
        testName: "should preserve existing title.limit",
        spec: { title: { text: "My Chart", limit: 50 }, mark: "bar" },
        containerWidth: 100,
        expectedLimit: 50,
        expectedText: "My Chart",
      },
      {
        testName: "should set title.limit to 0 for small widths",
        spec: { title: "My Chart", mark: "bar" },
        containerWidth: 30,
        expectedLimit: 0,
        expectedText: "My Chart",
      },
      {
        testName: "should calculate title.limit for large widths",
        spec: { title: "My Chart", mark: "bar" },
        containerWidth: 800,
        expectedLimit: 760,
        expectedText: "My Chart",
      },
    ])(
      "$testName",
      ({
        spec: specInput,
        containerWidth: testContainerWidth,
        expectedLimit,
        expectedText,
      }) => {
        const { result } = renderHook(
          (element: VegaLiteChartElement) =>
            useVegaElementPreprocessor(
              element,
              testContainerWidth,
              containerHeight,
              useContainerWidth,
              useContainerHeight
            ),
          {
            initialProps: getElement({
              spec: JSON.stringify(specInput),
            }),
          }
        )
        const spec = result.current.spec as unknown as VegaLiteSpec
        expect((spec.title as { text: string }).text).toBe(expectedText)
        expect((spec.title as { limit: number }).limit).toBe(expectedLimit)
      }
    )
  })

  describe("container sizing and useContainerWidth/Height scenarios", () => {
    it.each([
      {
        testName: "sets spec.width when useContainerWidth=true",
        containerWidth: 400,
        containerHeight: 300,
        useContainerWidth: true,
        useContainerHeight: false,
        expectedWidth: 400,
        expectedHeight: undefined,
      },
      {
        testName:
          "does not set spec.width when useContainerWidth=true but containerWidth<=0",
        containerWidth: 0,
        containerHeight: 300,
        useContainerWidth: true,
        useContainerHeight: false,
        expectedWidth: undefined,
        expectedHeight: undefined,
      },
      {
        testName: "sets spec.height when useContainerHeight=true",
        containerWidth: 400,
        containerHeight: 300,
        useContainerWidth: false,
        useContainerHeight: true,
        expectedWidth: undefined,
        expectedHeight: 300,
      },
      {
        testName:
          "does not set spec.height when useContainerHeight=true but containerHeight<=0",
        containerWidth: 400,
        containerHeight: 0,
        useContainerWidth: false,
        useContainerHeight: true,
        expectedWidth: undefined,
        expectedHeight: undefined,
      },
      {
        testName: "sets both spec.width and spec.height when both are true",
        containerWidth: 500,
        containerHeight: 400,
        useContainerWidth: true,
        useContainerHeight: true,
        expectedWidth: 500,
        expectedHeight: 400,
      },
      {
        testName: "does not set dimensions when both are false",
        containerWidth: 600,
        containerHeight: 500,
        useContainerWidth: false,
        useContainerHeight: false,
        expectedWidth: undefined,
        expectedHeight: undefined,
      },
    ])(
      "$testName",
      ({
        containerWidth,
        containerHeight,
        useContainerWidth,
        useContainerHeight,
        expectedWidth,
        expectedHeight,
      }) => {
        const { result } = renderHook(
          (element: VegaLiteChartElement) =>
            useVegaElementPreprocessor(
              element,
              containerWidth,
              containerHeight,
              useContainerWidth,
              useContainerHeight
            ),
          {
            initialProps: getElement({
              useContainerWidth,
              spec: JSON.stringify({
                title: "Test Chart",
                mark: "bar",
              }),
            }),
          }
        )

        const spec = result.current
          .spec as unknown as VegaLiteSpecWithDimensions
        expect(spec.width).toBe(expectedWidth)
        expect(spec.height).toBe(expectedHeight)
        expect(result.current.useContainerWidth).toBe(useContainerWidth)
      }
    )

    it("updates spec dimensions when container size changes", () => {
      const { result, rerender } = renderHook(
        ({
          containerWidth,
          containerHeight,
        }: {
          containerWidth: number
          containerHeight: number
        }) =>
          useVegaElementPreprocessor(
            getElement({
              useContainerWidth: true,
              spec: JSON.stringify({
                title: "Responsive Chart",
                mark: "bar",
              }),
            }),
            containerWidth,
            containerHeight,
            true, // useContainerWidth=true
            true // useContainerHeight=true
          ),
        {
          initialProps: { containerWidth: 100, containerHeight: 100 },
        }
      )

      // Start with small container
      const { spec: smallSpec } = result.current
      const smallSpecTyped = smallSpec as unknown as VegaLiteSpecWithDimensions
      expect(smallSpecTyped.width).toBe(100) // Default from test setup
      expect(smallSpecTyped.height).toBe(100) // Default from test setup

      // Resize to large container
      rerender({ containerWidth: 800, containerHeight: 600 })
      const { spec: largeSpec } = result.current
      const largeSpecTyped = largeSpec as unknown as VegaLiteSpecWithDimensions
      expect(largeSpecTyped.width).toBe(800)
      expect(largeSpecTyped.height).toBe(600)

      // Verify specs are different objects (memoization working correctly)
      expect(largeSpec).not.toBe(smallSpec)
    })

    it("handles title limit calculation with different container widths", () => {
      const testCases = [
        { width: 50, expectedLimit: 10 }, // 50 - 40 = 10
        { width: 30, expectedLimit: 0 }, // Math.max(30 - 40, 0) = 0
        { width: 400, expectedLimit: 360 }, // 400 - 40 = 360
        { width: 800, expectedLimit: 760 }, // 800 - 40 = 760
      ]

      testCases.forEach(({ width, expectedLimit }) => {
        const { result } = renderHook(
          (element: VegaLiteChartElement) =>
            useVegaElementPreprocessor(
              element,
              width,
              100, // height doesn't matter for title limit
              false,
              false
            ),
          {
            initialProps: getElement({
              spec: JSON.stringify({
                title: "Test Chart",
                mark: "bar",
              }),
            }),
          }
        )

        const spec = result.current.spec as unknown as VegaLiteSpec
        expect((spec.title as { limit: number }).limit).toBe(expectedLimit)
      })
    })
  })

  describe("vconcat width handling", () => {
    it("sets width on simple vconcat children when useContainerWidth=true", () => {
      const vconcatSpec = {
        vconcat: [
          { mark: "bar", encoding: { x: { field: "a" }, y: { field: "b" } } },
          {
            mark: "point",
            encoding: { x: { field: "a" }, y: { field: "b" } },
          },
        ],
      }

      const { result } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(element, 400, 300, true, false),
        {
          initialProps: getElement({
            spec: JSON.stringify(vconcatSpec),
          }),
        }
      )

      const spec = result.current.spec as unknown as {
        vconcat: { width?: number }[]
      }
      expect(spec.vconcat[0].width).toBe(400)
      expect(spec.vconcat[1].width).toBe(400)
    })

    it.each([
      {
        name: "hconcat",
        spec: {
          vconcat: [
            { mark: "bar", encoding: { x: { field: "a" } } },
            { hconcat: [{ mark: "point" }, { mark: "line" }] },
          ],
        },
        expectedWidths: [400, undefined],
      },
      {
        name: "nested vconcat",
        spec: {
          vconcat: [
            { vconcat: [{ mark: "bar" }, { mark: "point" }] },
            { mark: "line" },
          ],
        },
        expectedWidths: [undefined, 400],
      },
      {
        name: "concat",
        spec: {
          vconcat: [
            { concat: [{ mark: "bar" }, { mark: "point" }] },
            { mark: "line" },
          ],
        },
        expectedWidths: [undefined, 400],
      },
      {
        name: "facet",
        spec: {
          vconcat: [
            {
              facet: { column: { field: "group" } },
              spec: { mark: "line", encoding: { x: { field: "a" } } },
            },
            { mark: "bar" },
          ],
        },
        expectedWidths: [undefined, 400],
      },
      {
        name: "repeat",
        spec: {
          vconcat: [
            {
              repeat: { row: ["a", "b"] },
              spec: { mark: "line", encoding: { x: { field: "a" } } },
            },
            { mark: "bar" },
          ],
        },
        expectedWidths: [undefined, 400],
      },
    ])(
      "skips width on vconcat children that contain $name",
      ({ spec: inputSpec, expectedWidths }) => {
        const { result } = renderHook(
          (element: VegaLiteChartElement) =>
            useVegaElementPreprocessor(element, 400, 300, true, false),
          {
            initialProps: getElement({
              spec: JSON.stringify(inputSpec),
            }),
          }
        )

        const spec = result.current.spec as unknown as {
          vconcat: { width?: number }[]
        }
        expect(spec.vconcat[0].width).toBe(expectedWidths[0])
        expect(spec.vconcat[1].width).toBe(expectedWidths[1])
      }
    )

    it("sets width on vconcat children that contain layer", () => {
      const layerVconcatSpec = {
        vconcat: [
          { layer: [{ mark: "line" }, { mark: "point" }] },
          { mark: "bar" },
        ],
      }

      const { result } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(element, 400, 300, true, false),
        {
          initialProps: getElement({
            spec: JSON.stringify(layerVconcatSpec),
          }),
        }
      )

      const spec = result.current.spec as unknown as {
        vconcat: { width?: number }[]
      }
      expect(spec.vconcat[0].width).toBe(400)
      expect(spec.vconcat[1].width).toBe(400)
    })
  })

  describe("baseSpecKey", () => {
    const renderWithDimensions = (
      element: VegaLiteChartElement,
      useWidth: boolean,
      useHeight: boolean
    ): ReturnType<
      typeof renderHook<
        { containerWidth: number; containerHeight: number },
        ReturnType<typeof useVegaElementPreprocessor>
      >
    > =>
      renderHook(
        ({
          containerWidth,
          containerHeight,
        }: {
          containerWidth: number
          containerHeight: number
        }) =>
          useVegaElementPreprocessor(
            element,
            containerWidth,
            containerHeight,
            useWidth,
            useHeight
          ),
        {
          initialProps: { containerWidth: 100, containerHeight: 100 },
        }
      )

    it("stays stable across container dimension changes for a single-view chart", () => {
      const { result, rerender } = renderWithDimensions(
        getElement({
          useContainerWidth: true,
          spec: JSON.stringify({
            mark: "bar",
            encoding: { x: { field: "a" } },
          }),
        }),
        true,
        true
      )

      const initialKey = result.current.baseSpecKey
      rerender({ containerWidth: 800, containerHeight: 600 })

      // The native resize path handles dimension changes, so the structural key
      // must not change (otherwise the view would be recreated unnecessarily).
      expect(result.current.baseSpecKey).toBe(initialKey)
    })

    it("changes when the structural spec changes", () => {
      const { result, rerender } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(element, 100, 100, false, false),
        {
          initialProps: getElement({
            spec: JSON.stringify({
              mark: "bar",
              encoding: { x: { field: "a" } },
            }),
          }),
        }
      )

      const initialKey = result.current.baseSpecKey
      rerender(
        getElement({
          spec: JSON.stringify({
            mark: "line",
            encoding: { x: { field: "a" } },
          }),
        })
      )

      expect(result.current.baseSpecKey).not.toBe(initialKey)
    })

    it("changes when a fixed (non-container) dimension changes", () => {
      const { result, rerender } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(element, 100, 100, false, false),
        {
          initialProps: getElement({
            spec: JSON.stringify({ mark: "bar", width: 200 }),
          }),
        }
      )

      const initialKey = result.current.baseSpecKey
      rerender(
        getElement({ spec: JSON.stringify({ mark: "bar", width: 400 }) })
      )

      expect(result.current.baseSpecKey).not.toBe(initialKey)
    })

    it("changes when the container sizing mode toggles", () => {
      const element = getElement({
        spec: JSON.stringify({ mark: "bar", encoding: { x: { field: "a" } } }),
      })
      const { result, rerender } = renderHook(
        ({ useWidth }: { useWidth: boolean }) =>
          useVegaElementPreprocessor(element, 100, 100, useWidth, false),
        {
          initialProps: { useWidth: false },
        }
      )

      const initialKey = result.current.baseSpecKey
      rerender({ useWidth: true })

      expect(result.current.baseSpecKey).not.toBe(initialKey)
    })

    it("changes on container width change for a concat chart (forces recreation)", () => {
      const { result, rerender } = renderWithDimensions(
        getElement({
          useContainerWidth: true,
          spec: JSON.stringify({
            vconcat: [{ mark: "bar" }, { mark: "point" }],
          }),
        }),
        true,
        false
      )

      const initialKey = result.current.baseSpecKey
      rerender({ containerWidth: 800, containerHeight: 100 })

      // Concat charts bake per-child widths, so a width change must recreate the
      // view (the native resize API cannot update them).
      expect(result.current.baseSpecKey).not.toBe(initialKey)
    })

    it("stays stable for a concat chart that does not use container width", () => {
      const { result, rerender } = renderWithDimensions(
        getElement({
          useContainerWidth: false,
          spec: JSON.stringify({
            vconcat: [{ mark: "bar" }, { mark: "point" }],
          }),
        }),
        false,
        false
      )

      const initialKey = result.current.baseSpecKey
      rerender({ containerWidth: 800, containerHeight: 600 })

      expect(result.current.baseSpecKey).toBe(initialKey)
    })
  })

  describe("builtin color name resolution", () => {
    const themeColors = lightTheme.emotion.colors

    it("resolves single builtin color name to theme color", () => {
      const { result } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(
            element,
            containerWidth,
            containerHeight,
            useContainerWidth,
            useContainerHeight
          ),
        {
          initialProps: getElement({
            spec: JSON.stringify({
              mark: "bar",
              encoding: {
                x: { field: "a" },
                y: { field: "b" },
                color: { value: "red" },
              },
            }),
          }),
        }
      )

      const spec = result.current.spec as unknown as {
        encoding: { color: { value: string } }
      }
      expect(spec.encoding.color.value).toBe(themeColors.redColor)
    })

    it("resolves builtin color names in scale range", () => {
      const { result } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(
            element,
            containerWidth,
            containerHeight,
            useContainerWidth,
            useContainerHeight
          ),
        {
          initialProps: getElement({
            spec: JSON.stringify({
              mark: "bar",
              encoding: {
                x: { field: "a" },
                y: { field: "b" },
                color: {
                  field: "category",
                  scale: { range: ["blue", "green"] },
                },
              },
            }),
          }),
        }
      )

      const spec = result.current.spec as unknown as {
        encoding: { color: { scale: { range: string[] } } }
      }
      expect(spec.encoding.color.scale.range).toEqual([
        themeColors.blueColor,
        themeColors.greenColor,
      ])
    })

    it("resolves builtin colors in layer specs", () => {
      const { result } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(
            element,
            containerWidth,
            containerHeight,
            useContainerWidth,
            useContainerHeight
          ),
        {
          initialProps: getElement({
            spec: JSON.stringify({
              layer: [
                {
                  mark: "line",
                  encoding: {
                    x: { field: "a" },
                    y: { field: "b" },
                    color: { value: "violet" },
                  },
                },
              ],
            }),
          }),
        }
      )

      type LayerSpec = {
        layer: Array<{ encoding: { color: { value: string } } }>
      }
      const spec = result.current.spec as unknown as LayerSpec
      expect(spec.layer[0].encoding.color.value).toBe(themeColors.violetColor)
    })

    it("leaves hex colors unchanged", () => {
      const { result } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(
            element,
            containerWidth,
            containerHeight,
            useContainerWidth,
            useContainerHeight
          ),
        {
          initialProps: getElement({
            spec: JSON.stringify({
              mark: "bar",
              encoding: {
                x: { field: "a" },
                y: { field: "b" },
                color: { value: "#ff0000" },
              },
            }),
          }),
        }
      )

      const spec = result.current.spec as unknown as {
        encoding: { color: { value: string } }
      }
      expect(spec.encoding.color.value).toBe("#ff0000")
    })

    it("resolves primary color to theme primary", () => {
      const { result } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(
            element,
            containerWidth,
            containerHeight,
            useContainerWidth,
            useContainerHeight
          ),
        {
          initialProps: getElement({
            spec: JSON.stringify({
              mark: "bar",
              encoding: {
                x: { field: "a" },
                y: { field: "b" },
                color: { value: "primary" },
              },
            }),
          }),
        }
      )

      const spec = result.current.spec as unknown as {
        encoding: { color: { value: string } }
      }
      expect(spec.encoding.color.value).toBe(themeColors.primary)
    })
  })

  describe("selection mode parameter preparation", () => {
    type SelectParam = {
      name: string
      select?:
        | string
        | { type?: string; encodings?: string[]; [key: string]: unknown }
      value?: unknown
    }

    const renderWithParams = (
      params: SelectParam[],
      selectionMode: string[] = ["point"]
    ): SelectParam[] => {
      const { result } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(
            element,
            containerWidth,
            containerHeight,
            useContainerWidth,
            useContainerHeight
          ),
        {
          initialProps: getElement({
            selectionMode,
            spec: JSON.stringify({
              mark: "point",
              encoding: { x: { field: "a" }, y: { field: "b" } },
              params,
            }),
          }),
        }
      )
      return (result.current.spec as unknown as { params: SelectParam[] })
        .params
    }

    it("adds all chart encodings to shorthand point selections", () => {
      const [param] = renderWithParams([{ name: "pt", select: "point" }])
      expect(param.select).toEqual({ type: "point", encodings: ["x", "y"] })
    })

    it("converts shorthand interval selections without adding encodings", () => {
      const [param] = renderWithParams([{ name: "iv", select: "interval" }])
      expect(param.select).toEqual({ type: "interval" })
    })

    it("preserves user-specified encodings on point selections", () => {
      const [param] = renderWithParams([
        { name: "pt", select: { type: "point", encodings: ["x"] } },
      ])
      expect(param.select).toEqual({ type: "point", encodings: ["x"] })
    })

    it("skips params without a select property", () => {
      const [param] = renderWithParams([{ name: "slider", value: 5 }])
      expect(param.select).toBeUndefined()
      expect(param.value).toBe(5)
    })

    it("leaves unknown string selections untouched", () => {
      const [param] = renderWithParams([{ name: "weird", select: "unknown" }])
      expect(param.select).toBe("unknown")
    })

    it("skips select objects that are missing a type", () => {
      const [param] = renderWithParams([
        { name: "no_type", select: { foo: "bar" } },
      ])
      expect(param.select).toEqual({ foo: "bar" })
    })

    it("does not transform params when selectionMode is empty", () => {
      const [param] = renderWithParams([{ name: "pt", select: "point" }], [])
      // With an empty selection mode, prepareSpecForSelections is skipped, so the
      // shorthand string is left as-is.
      expect(param.select).toBe("point")
    })
  })

  describe("legacy and edge-case spec handling", () => {
    const renderSpec = (
      specInput: Record<string, unknown>,
      overrides: {
        vegaLiteTheme?: string
        useWidth?: boolean
      } = {}
    ): Record<string, unknown> => {
      const useWidth = overrides.useWidth ?? useContainerWidth
      const { result } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(
            element,
            containerWidth,
            containerHeight,
            useWidth,
            useContainerHeight
          ),
        {
          initialProps: getElement({
            vegaLiteTheme: overrides.vegaLiteTheme ?? "streamlit",
            useContainerWidth: useWidth,
            spec: JSON.stringify(specInput),
          }),
        }
      )
      return result.current.spec as unknown as Record<string, unknown>
    }

    it.each([
      { name: "zero height", key: "height", value: 0 },
      { name: "negative height", key: "height", value: -10 },
      { name: "zero width", key: "width", value: 0 },
      { name: "negative width", key: "width", value: -10 },
    ])("removes non-positive $name from the spec", ({ key, value }) => {
      const spec = renderSpec({ mark: "bar", [key]: value })
      expect(spec[key]).toBeUndefined()
    })

    it("applies the streamlit theme from usermeta embedOptions", () => {
      const spec = renderSpec(
        {
          mark: "bar",
          usermeta: { embedOptions: { theme: "streamlit" } },
        },
        { vegaLiteTheme: "default" }
      )
      // The streamlit theme is applied to config...
      expect(spec.config).toBeDefined()
      // ...and the embed options are cleared so vega-embed doesn't re-apply them.
      expect((spec.usermeta as { embedOptions?: unknown }).embedOptions).toBe(
        undefined
      )
    })

    it("preserves safe vega-embed options while removing risky embedOptions", () => {
      const spec = renderSpec(
        {
          mark: "bar",
          usermeta: {
            embedOptions: {
              theme: "dark",
              renderer: "canvas",
              padding: 12,
              actions: true,
              sourceHeader: "<script>window.evil = true</script>",
              sourceFooter: "<img src=x onerror=window.evil = true>",
              editorUrl: "https://example.com/editor/",
              loader: { http: { credentials: "include" } },
            },
          },
        },
        { vegaLiteTheme: "default" }
      )

      expect(
        (spec.usermeta as { embedOptions?: unknown }).embedOptions
      ).toEqual({ theme: "dark", renderer: "canvas", padding: 12 })
    })

    it("preserves vega-embed padding side objects", () => {
      const spec = renderSpec(
        {
          mark: "bar",
          usermeta: {
            embedOptions: {
              renderer: "svg",
              padding: {
                left: 1,
                right: 2,
                top: 3,
                bottom: 4,
                unknown: 5,
              },
            },
          },
        },
        { vegaLiteTheme: "default" }
      )

      expect(
        (spec.usermeta as { embedOptions?: unknown }).embedOptions
      ).toEqual({
        renderer: "svg",
        padding: { left: 1, right: 2, top: 3, bottom: 4 },
      })
    })

    it("preserves a null vega-embed theme for backwards compatibility", () => {
      const spec = renderSpec(
        {
          mark: "bar",
          usermeta: {
            embedOptions: {
              theme: null,
              actions: true,
            },
          },
        },
        { vegaLiteTheme: "default" }
      )

      expect(
        (spec.usermeta as { embedOptions?: unknown }).embedOptions
      ).toEqual({ theme: null })
    })

    it("removes invalid renderer and padding embedOptions", () => {
      const spec = renderSpec(
        {
          mark: "bar",
          usermeta: {
            embedOptions: {
              renderer: "none",
              padding: {
                left: "1",
                right: -2,
                top: null,
                bottom: [],
              },
              actions: true,
            },
          },
        },
        { vegaLiteTheme: "default" }
      )

      expect((spec.usermeta as { embedOptions?: unknown }).embedOptions).toBe(
        undefined
      )
    })

    it("skips null children when spreading container width across vconcat", () => {
      const spec = renderSpec(
        { vconcat: [null, { mark: "bar" }] },
        { useWidth: true }
      )
      const [first, second] = spec.vconcat as (Record<
        string,
        unknown
      > | null)[]
      expect(first).toBeNull()
      expect((second as { width?: number }).width).toBe(containerWidth)
    })

    it("throws when datasets are included in the spec", () => {
      expect(() => renderSpec({ mark: "bar", datasets: { foo: [] } })).toThrow(
        "Datasets should not be passed as part of the spec"
      )
    })
  })
})
