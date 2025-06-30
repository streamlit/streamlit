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

import React from "react"

import { screen } from "@testing-library/react"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"
import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import * as useRequiredContextModule from "~lib/hooks/useRequiredContext"

import ArrowVegaLiteChart, { Props } from "./ArrowVegaLiteChart"
import { VegaLiteChartElement } from "./arrowUtils"

const getProps = (
  elementProps: Partial<VegaLiteChartElement> = {},
  props: Partial<Props> = {}
): Props => ({
  element: {
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
  },
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...props,
})

describe("ArrowVegaLiteChart", () => {
  beforeEach(() => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders without crashing", () => {
    render(<ArrowVegaLiteChart {...getProps()} />)
    const vegaLiteChart = screen.getByTestId("stVegaLiteChart")
    expect(vegaLiteChart).toBeInTheDocument()
    expect(vegaLiteChart).toHaveClass("stVegaLiteChart")
  })

  it("uses the fullscreen width and height when in fullscreen mode", () => {
    // Save the original implementation
    const originalUseRequiredContext =
      useRequiredContextModule.useRequiredContext

    vi.spyOn(
      useRequiredContextModule,
      "useRequiredContext"
    ).mockImplementation(ctx => {
      if (ctx.displayName === "ElementFullscreenContext") {
        return {
          expanded: true,
          width: 999,
          height: 888,
          expand: vi.fn(),
          collapse: vi.fn(),
        }
      }
      // For all other contexts, use the original implementation
      return originalUseRequiredContext(ctx)
    })

    render(<ArrowVegaLiteChart {...getProps()} />)
    const vegaLiteChart = screen.getByTestId("stVegaLiteChart")
    const StyledToolbarElementContainer = vegaLiteChart.parentElement
    expect(StyledToolbarElementContainer).toBeInTheDocument()
    expect(StyledToolbarElementContainer).toHaveStyle({ width: "999" })
    expect(StyledToolbarElementContainer).toHaveStyle({ height: "888" })
  })

  it("sets the style width to 250px when useContainerWidth is true", () => {
    render(<ArrowVegaLiteChart {...getProps({ useContainerWidth: true })} />)
    const vegaLiteChart = screen.getByTestId("stVegaLiteChart")

    const StyledToolbarElementContainer = vegaLiteChart.parentElement
    expect(StyledToolbarElementContainer).toBeInTheDocument()
    // The style should be width: 250px (from the mocked useResizeObserver)
    expect(StyledToolbarElementContainer).toHaveStyle({ width: "250px" })
  })

  it("sets the style width to fit-content when useContainerWidth is false", () => {
    render(<ArrowVegaLiteChart {...getProps({ useContainerWidth: false })} />)
    const vegaLiteChart = screen.getByTestId("stVegaLiteChart")
    const StyledToolbarElementContainer = vegaLiteChart.parentElement
    expect(StyledToolbarElementContainer).toBeInTheDocument()
    // The style should be width: fit-content
    expect(StyledToolbarElementContainer).toHaveStyle({ width: "fit-content" })
  })
})
