/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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
import { mount } from "src/lib/test_util"
import Plot from "react-plotly.js"

import ThemeProvider from "src/components/core/ThemeProvider"
import { darkTheme } from "src/theme"
import { PlotlyChart as PlotlyChartProto } from "src/autogen/proto"
import mock from "./mock"
import { DEFAULT_HEIGHT, PlotlyChartProps } from "./PlotlyChart"

jest.mock("react-plotly.js", () => jest.fn(() => null))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PlotlyChart } = require("./PlotlyChart")

const getProps = (
  elementProps: Partial<PlotlyChartProto> = {}
): PlotlyChartProps => ({
  element: PlotlyChartProto.create({
    ...mock,
    ...elementProps,
  }),
  width: 0,
  height: 0,
})

describe("PlotlyChart Element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<PlotlyChart {...props} />)

    expect(wrapper.find(Plot).length).toBe(1)
  })

  describe("Dimensions", () => {
    it("fullscreen", () => {
      const props = {
        ...getProps(),
        height: 400,
        width: 400,
      }
      const wrapper = mount(<PlotlyChart {...props} />)

      expect(wrapper.find(Plot).props()).toMatchSnapshot()
    })

    it("useContainerWidth", () => {
      const props = {
        ...getProps({
          useContainerWidth: true,
        }),
        width: 400,
      }
      const wrapper = mount(<PlotlyChart {...props} />)
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
      const wrapper = mount(<PlotlyChart {...props} />)

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
      const wrapper = mount(<PlotlyChart {...propsWithHeight} />)

      // @ts-ignore
      expect(wrapper.find("iframe").prop("style").height).toBe(400)
    })
  })

  describe("Theming", () => {
    it("pulls default config values from theme", () => {
      const props = getProps()
      const wrapper = mount(
        <ThemeProvider
          theme={darkTheme.emotion}
          baseuiTheme={darkTheme.basewebTheme}
        >
          <PlotlyChart {...props} />
        </ThemeProvider>
      )

      const { layout } = wrapper
        .find(Plot)
        .first()
        .props()
      expect(layout.paper_bgcolor).toBe(darkTheme.emotion.colors.bgColor)
      expect(layout.font.color).toBe(darkTheme.emotion.colors.bodyText)
    })

    it("has user specified config take priority", () => {
      const props = getProps()

      const spec = JSON.parse(props.element.figure.spec)
      spec.layout = {
        ...spec.layout,
        paper_bgcolor: "orange",
      }

      props.element.figure.spec = JSON.stringify(spec)

      const wrapper = mount(
        <ThemeProvider
          theme={darkTheme.emotion}
          baseuiTheme={darkTheme.basewebTheme}
        >
          <PlotlyChart {...props} />
        </ThemeProvider>
      )

      const { layout } = wrapper
        .find(Plot)
        .first()
        .props()
      expect(layout.paper_bgcolor).toBe("orange")
      // Verify that things not overwritten by the user still fall back to the
      // theme default.
      expect(layout.font.color).toBe(darkTheme.emotion.colors.bodyText)
    })
  })
})
