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

jest.mock("react-plotly.js", () => jest.fn())

import React from "react"
import { shallow } from "enzyme"
import { fromJS } from "immutable"
import Plot from "react-plotly.js"

import mock from "./mock"
import { PropsWithHeight, DEFAULT_HEIGHT } from "./PlotlyChart"

const PlotlyChart = require("./PlotlyChart").PlotlyChart

const getProps = (elementProps: object = {}): PropsWithHeight => ({
  element: fromJS({
    ...mock,
    ...elementProps,
  }),
  width: 0,
  height: 0,
})

describe("PlotlyChart Element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<PlotlyChart {...props} />)

    expect(wrapper.find(Plot).length).toBe(1)
  })

  describe("Dimensions", () => {
    it("fullscreen", () => {
      const props = {
        ...getProps(),
        height: 400,
        width: 400,
      }
      const wrapper = shallow(<PlotlyChart {...props} />)

      expect(wrapper.find(Plot).props()).toMatchSnapshot()
    })

    it("useContainerWidth", () => {
      const props = {
        ...getProps({
          useContainerWidth: true,
        }),
        width: 400,
      }
      const wrapper = shallow(<PlotlyChart {...props} />)
      expect(wrapper.find(Plot).props()).toMatchSnapshot()
    })
  })

  describe("Render iframe", () => {
    const props = getProps({
      chart: "url",
      url: "http://url.test",
      figure: undefined,
    })

    it("should render an iframe", () => {
      const wrapper = shallow(<PlotlyChart {...props} />)

      expect(wrapper.find("iframe").length).toBe(1)
      expect(wrapper.find("iframe").props()).toMatchSnapshot()
      // @ts-ignore
      expect(wrapper.find("iframe").prop("style").height).toBe(DEFAULT_HEIGHT)
    })

    it("it should render with an specific height", () => {
      const propsWithHeight = {
        ...props,
        height: 400,
        width: 500,
      }
      const wrapper = shallow(<PlotlyChart {...propsWithHeight} />)

      // @ts-ignore
      expect(wrapper.find("iframe").prop("style").height).toBe(400)
    })
  })
})
