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
import { graphviz } from "d3-graphviz"
import { logError } from "src/lib/util/log"
import { mount } from "src/lib/test_util"
import { GraphVizChart as GraphVizChartProto } from "src/lib/proto"
import { GraphVizChart, GraphVizChartProps } from "./GraphVizChart"

jest.mock("d3-graphviz", () => ({
  graphviz: jest.fn().mockReturnValue({
    zoom: () => ({
      fit: () => ({
        scale: () => ({
          renderDot: () => ({
            on: jest.fn(),
          }),
        }),
      }),
    }),
  }),
}))
jest.mock("src/lib/util/log", () => ({
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

  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<GraphVizChart {...props} />)

    expect(wrapper.find("StyledGraphVizChart").length).toBe(1)
    expect(logError).not.toHaveBeenCalled()
    expect(graphviz).toHaveBeenCalled()
  })

  it("should call updateChart and log error when crashes", () => {
    const props = getProps({
      spec: "crash",
    })
    const wrapper = mount(<GraphVizChart {...props} />)

    // @ts-expect-error
    logError.mockClear()

    wrapper.setProps({
      width: 400,
      height: 500,
    })

    expect(logError).toHaveBeenCalledTimes(1)
  })

  it("should render with height and width", () => {
    const props = {
      ...getProps(),
      height: 500,
      width: 400,
    }
    const wrapper = mount(<GraphVizChart {...props} />)

    expect(wrapper.find("StyledGraphVizChart").props()).toMatchSnapshot()
  })
})
