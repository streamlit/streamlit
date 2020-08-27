/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { mount } from "enzyme"
import { fromJS } from "immutable"

import { GraphVizChartProps } from "./GraphVizChart"

const mockLogError = {
  logError: jest.fn(),
}

const mockGraphViz = jest.fn().mockReturnValue({
  zoom: () => ({
    fit: () => ({
      scale: () => ({
        renderDot: () => ({
          on: jest.fn(),
        }),
      }),
    }),
  }),
})

jest.mock("d3", () => ({
  select: jest.fn().mockReturnValue({
    graphviz: mockGraphViz,
  }),
}))
jest.mock("d3-graphviz")
jest.mock("lib/log", () => mockLogError)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GraphVizChart } = require("./GraphVizChart")

const getProps = (
  elementProps: Record<string, unknown> = {}
): GraphVizChartProps => ({
  element: fromJS({
    spec: `digraph "Hello World" {Hello -> World}`,
    ...elementProps,
  }),
  width: 0,
  index: 0,
  height: undefined,
})

describe("GraphVizChart Element", () => {
  beforeEach(() => {
    mockLogError.logError.mockClear()
  })

  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<GraphVizChart {...props} />)

    expect(wrapper.find(".stGraphVizChart").length).toBe(1)
    expect(mockLogError.logError).not.toHaveBeenCalled()
    expect(mockGraphViz).toHaveBeenCalled()
  })

  it("should call updateChart and log error when crashes", () => {
    const props = getProps({
      spec: "crash",
    })
    const wrapper = mount(<GraphVizChart {...props} />)

    mockLogError.logError.mockClear()

    wrapper.setProps({
      width: 400,
      height: 500,
    })

    expect(mockLogError.logError).toHaveBeenCalledTimes(1)
  })

  it("should render with height and width", () => {
    const props = {
      ...getProps(),
      height: 500,
      width: 400,
      index: 1,
    }
    const wrapper = mount(<GraphVizChart {...props} />)

    expect(wrapper.find(".stGraphVizChart").props()).toMatchSnapshot()
  })
})
