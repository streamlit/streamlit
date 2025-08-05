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
import { graphviz } from "d3-graphviz"
import { Mock, MockInstance } from "vitest"

import { GraphVizChart as GraphVizChartProto } from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"

import GraphVizChart, { GraphVizChartProps, LOG } from "./GraphVizChart"

vi.mock("d3-graphviz", () => ({
  graphviz: vi.fn().mockReturnValue({
    zoom: () => ({
      fit: () => ({
        scale: () => ({
          engine: () => ({
            renderDot: () => ({
              on: vi.fn(),
            }),
          }),
        }),
      }),
    }),
  }),
}))

const getProps = (
  elementProps: Partial<GraphVizChartProto> = {}
): GraphVizChartProps => ({
  element: GraphVizChartProto.create({
    spec: `digraph "Hello World" {Hello -> World}`,
    elementId: "1",
    ...elementProps,
  }),
})

describe("GraphVizChart Element", () => {
  let logErrorSpy: MockInstance

  beforeEach(() => {
    logErrorSpy = vi.spyOn(LOG, "error").mockImplementation(() => {})

    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  afterEach(() => {
    // @ts-expect-error
    graphviz.mockClear()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<GraphVizChart {...props} />)

    const graphvizElement = screen.getByTestId("stGraphVizChart")
    expect(graphvizElement).toBeInTheDocument()
    expect(graphvizElement).toHaveClass("stGraphVizChart")

    expect(logErrorSpy).not.toHaveBeenCalled()
    expect(graphviz).toHaveBeenCalled()
  })

  it("should update chart and log error when crashes", () => {
    // Mock graphviz().renderDot() to throw an error for the "crash" spec
    const mockRenderDot = vi.fn().mockImplementation(spec => {
      if (spec === "crash") {
        throw new Error("Simulated GraphViz crash")
      }
      return {
        on: vi.fn(),
      }
    })

    // Modify the graphviz mock to use the mockRenderDot
    ;(graphviz as Mock).mockReturnValue({
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

    expect(logErrorSpy).toHaveBeenCalledTimes(1)
    expect(mockRenderDot).toHaveBeenCalledWith("crash")
    expect(graphviz).toHaveBeenCalledTimes(1)
  })

  it("should render with height and width set to auto", () => {
    const props = {
      ...getProps(),
    }
    render(<GraphVizChart {...props} />)

    expect(screen.getByTestId("stGraphVizChart")).toHaveStyle(
      "height: auto; width: auto"
    )
  })
})
