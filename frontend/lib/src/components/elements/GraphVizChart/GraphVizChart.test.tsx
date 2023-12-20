/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
  isFullScreen: false,
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

  it("should update chart and log error when crashes", () => {
    // Mock graphviz().renderDot() to throw an error for the "crash" spec
    const mockRenderDot = jest.fn().mockImplementation(spec => {
      if (spec === "crash") {
        throw new Error("Simulated GraphViz crash")
      }
      return {
        on: jest.fn(),
      }
    })

    // Modify the graphviz mock to use the mockRenderDot
    ;(graphviz as jest.Mock).mockReturnValue({
      zoom: () => ({
        fit: () => ({
          scale: () => ({
            engine: () => ({
              renderDot: mockRenderDot,
            }),
          }),
        }),
      }),
    })

    const props = getProps({
      spec: "crash",
    })

    render(<GraphVizChart {...props} />)

    expect(logError).toHaveBeenCalledTimes(1)
    expect(mockRenderDot).toHaveBeenCalledWith("crash")
    expect(graphviz).toHaveBeenCalledTimes(1)
  })

  it("shoud render with height and width set to auto", () => {
    const props = {
      ...getProps(),
    }
    render(<GraphVizChart {...props} />)

    expect(screen.getByTestId("stGraphVizChart")).toHaveStyle(
      "height: auto; width: auto"
    )
  })

  it("shoud render with height and width set to 100%", () => {
    const props = {
      ...getProps(),
      isFullScreen: true,
    }
    render(<GraphVizChart {...props} />)

    expect(screen.getByTestId("stGraphVizChart")).toHaveStyle(
      "height: 100%; width: 100%"
    )
  })
})
