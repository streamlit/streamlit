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
  const isFullScreen = false
  const width = 100
  const height = 100

  it("renders the same selectionMode even if reference changes", () => {
    const { result, rerender } = renderHook(
      (element: VegaLiteChartElement) =>
        useVegaElementPreprocessor(element, isFullScreen, width, height),
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
        useVegaElementPreprocessor(element, isFullScreen, width, height),
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
      (element: VegaLiteChartElement) =>
        useVegaElementPreprocessor(element, isFullScreen, width, height),
      {
        initialProps: getElement(),
      }
    )

    let { spec } = result.current
    const changes: Partial<VegaLiteChartElement>[] = [
      { useContainerWidth: true },
      { vegaLiteTheme: undefined },
      { selectionMode: ["single"] },
      { spec: "{}" },
    ]

    for (const change of changes) {
      rerender(getElement(change))

      expect(result.current.spec).not.toBe(spec)

      // Save the last spec to compare with the next one
      spec = result.current.spec
    }
  })

  describe("spec.title.limit", () => {
    const height = 100
    type VegaLiteSpec = {
      title?: string | { text: string; limit?: number }
      [key: string]: unknown
    }

    it("should not have title property if spec has no title", () => {
      const { result } = renderHook(
        (element: VegaLiteChartElement) =>
          useVegaElementPreprocessor(element, false, 100, height),
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
        width: 100,
        isFullScreen: false,
        expectedLimit: 60,
        expectedText: "My Chart",
      },
      {
        testName: "should set title.limit when title is an object",
        spec: { title: { text: "My Chart" }, mark: "bar" },
        width: 100,
        isFullScreen: false,
        expectedLimit: 60,
        expectedText: "My Chart",
      },
      {
        testName: "should preserve existing title.limit",
        spec: { title: { text: "My Chart", limit: 50 }, mark: "bar" },
        width: 100,
        isFullScreen: false,
        expectedLimit: 50,
        expectedText: "My Chart",
      },
      {
        testName: "should set title.limit to 0 for small widths",
        spec: { title: "My Chart", mark: "bar" },
        width: 30,
        isFullScreen: false,
        expectedLimit: 0,
        expectedText: "My Chart",
      },
      {
        testName:
          "should apply title.limit logic in fullscreen mode with a string title",
        spec: { title: "My Chart", mark: "bar" },
        width: 800,
        isFullScreen: true,
        expectedLimit: 760,
        expectedText: "My Chart",
      },
    ])(
      "$testName",
      ({
        spec: specInput,
        width,
        isFullScreen,
        expectedLimit,
        expectedText,
      }) => {
        const { result } = renderHook(
          (element: VegaLiteChartElement) =>
            useVegaElementPreprocessor(element, isFullScreen, width, height),
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
})
