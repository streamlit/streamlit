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

import { renderHook } from "~lib/components/shared/ElementFullscreen/testUtils"

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
        if (expectedText) {
          expect((spec.title as { text: string }).text).toBe(expectedText)
        }
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
        testName: "sets spec.height when useContainerHeight=true",
        containerWidth: 400,
        containerHeight: 300,
        useContainerWidth: false,
        useContainerHeight: true,
        expectedWidth: undefined,
        expectedHeight: 300,
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
})
