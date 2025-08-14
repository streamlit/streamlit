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
import userEvent from "@testing-library/user-event"

// Avoid real Vega embedding side-effects in tests
vi.mock("./useVegaEmbed", () => ({
  useVegaEmbed: () => {
    // Satisfy hooks rule by calling a React hook in this mock
    React.useMemo(() => null, [])
    return {
      createView: () => Promise.resolve(null),
      updateView: () => Promise.resolve(null),
      finalizeView: () => {},
    }
  },
}))

import { Quiver } from "~lib/dataframes/Quiver"
import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { UNICODE } from "~lib/mocks/arrow"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { VegaLiteChartElement } from "./arrowUtils"
import ArrowVegaLiteChart, { Props } from "./ArrowVegaLiteChart"

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

  it("renders without crashing", () => {
    render(<ArrowVegaLiteChart {...getProps()} />)
    const vegaLiteChart = screen.getByTestId("stVegaLiteChart")
    expect(vegaLiteChart).toBeInTheDocument()
    expect(vegaLiteChart).toHaveClass("stVegaLiteChart")
  })

  it("shows data grid when 'Show data' is clicked for inline data, and toggles back to chart", async () => {
    const user = userEvent.setup()

    const dataQuiver = new Quiver({ data: UNICODE })
    render(
      <ArrowVegaLiteChart {...getProps({ data: dataQuiver, datasets: [] })} />
    )

    // Initially, the chart container should be present
    expect(screen.getByTestId("stVegaLiteChart")).toBeVisible()

    // The toolbar action should be present when data exists
    const showDataButton = screen.getByRole("button", { name: "Show data" })

    // Click to show the data grid
    await user.click(showDataButton)

    // Should switch to grid view (Show chart action appears) and chart container hidden
    await screen.findByRole("button", { name: "Show chart" })
    expect(screen.queryByTestId("stVegaLiteChart")).toBeNull()

    // Click the custom toolbar action to show the chart again
    const showChartButton = await screen.findByRole("button", {
      name: "Show chart",
    })
    await user.click(showChartButton)

    // Chart should be shown again
    expect(await screen.findByTestId("stVegaLiteChart")).toBeInTheDocument()
    expect(screen.queryByTestId("stDataFrame")).toBeNull()
  })

  it("shows data grid when 'Show data' is clicked for first dataset", () => {
    const datasetQuiver = new Quiver({ data: UNICODE })
    render(
      <ArrowVegaLiteChart
        {...getProps({
          data: null,
          datasets: [
            {
              name: "dataset0",
              hasName: true,
              data: datasetQuiver,
            },
          ],
        })}
      />
    )

    // Initially, the chart container should be present
    expect(screen.getByTestId("stVegaLiteChart")).toBeVisible()

    // The toolbar action should be present when data exists
    expect(
      screen.queryByRole("button", { name: "Show data" })
    ).toBeInTheDocument()
  })

  it("does not show 'Show data' when neither data nor datasets are provided", () => {
    render(<ArrowVegaLiteChart {...getProps({ data: null, datasets: [] })} />)

    expect(screen.queryByRole("button", { name: "Show data" })).toBeNull()
  })
})
