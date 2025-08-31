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
      forceRecalculate: vitest.fn(),
      values: [250],
    })
  })

  it("renders without crashing", () => {
    render(<ArrowVegaLiteChart {...getProps()} />)
    const vegaLiteChart = screen.getByTestId("stVegaLiteChart")
    expect(vegaLiteChart).toBeInTheDocument()
    expect(vegaLiteChart).toHaveClass("stVegaLiteChart")
  })
})
