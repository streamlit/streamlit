/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import { graphviz } from "d3-graphviz"
import { logError } from "@streamlit/lib/src/util/log"
import { render } from "@streamlit/lib/src/test_util"
import { GraphVizChart as GraphVizChartProto } from "@streamlit/lib/src/proto"
import { GraphVizChart, GraphVizChartProps } from "./GraphVizChart"

jest.mock("d3-graphviz", () => ({
  graphviz: jest.fn().mockReturnValue({
    zoom: () => ({
      fit: () => ({
        scale: () => ({
          engine: () => ({
            renderDot: () => ({
              on: jest.fn(),
            }),
          }),
        }),
      }),
    }),
  }),
}))
jest.mock("@streamlit/lib/src/util/log", () => ({
  logError: jest.fn(),
  logMessage: jest.fn(),
}))

const getProps = (
  elementProps: Partial<GraphVizChartProto> = {}
): GraphVizChartProps => ({
  element: GraphVizChartProto.create({
    spec: `digraph "Hello World" {Hello -> World}`,
    elementId: "1",
    ...elementProps,
  }),
  width: 0,
  height: undefined,
})

describe("GraphVizChart Element", () => {
  beforeEach(() => {
    // @ts-expect-error
    logError.mockClear()
  })

  afterEach(() => {
    // @ts-expect-error
    graphviz.mockClear()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<GraphVizChart {...props} />)

    expect(screen.getByTestId("stGraphVizChart")).toBeInTheDocument()
    expect(logError).not.toHaveBeenCalled()
    expect(graphviz).toHaveBeenCalled()
  })

  it("should call updateChart and log error when crashes", () => {
    const props = getProps({
      spec: "crash",
    })
    const { rerender } = render(<GraphVizChart {...props} />)

    // @ts-expect-error
    logError.mockClear()

    const newProps = { ...props, height: 500, width: 400 }
    rerender(<GraphVizChart {...newProps} />)

    expect(logError).toHaveBeenCalledTimes(1)
    expect(graphviz).toHaveBeenCalledTimes(2)
  })

  it("should render with height and width", () => {
    const props = {
      ...getProps(),
      height: 500,
      width: 400,
    }
    render(<GraphVizChart {...props} />)

    expect(screen.getByTestId("stGraphVizChart")).toHaveStyle(
      "height: 500px; width: 400px"
    )
  })
})
