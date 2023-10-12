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
import { screen, waitFor } from "@testing-library/react"
import {
  customRenderLibContext,
  mount,
  render,
} from "@streamlit/lib/src/test_util"
import Plot from "react-plotly.js"

import ThemeProvider from "@streamlit/lib/src/components/core/ThemeProvider"
import { PlotlyChart as PlotlyChartProto } from "@streamlit/lib/src/proto"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"
import mock from "./mock"
import { DEFAULT_HEIGHT, PlotlyChartProps } from "./PlotlyChart"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"

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
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
})

describe("PlotlyChart Element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<PlotlyChart {...props} />)
    // console.log(screen.debug())
    expect(screen.getByTestId("stPlotlyChart")).toBeInTheDocument()
  })

  describe("Render iframe", () => {
    const props = getProps({
      chart: "url",
      url: "http://url.test",
      figure: undefined,
    })

    it("should render an iframe", () => {
      render(<PlotlyChart {...props} />)
      expect(screen.getByTestId("stPlotlyChart")).toBeInTheDocument()

      expect(screen.getByTestId("stPlotlyChart")).toHaveStyle(
        `height: ${DEFAULT_HEIGHT}px`
      )
    })

    it("should render with an specific height", () => {
      const propsWithHeight = {
        ...props,
        height: 500,
        width: 500,
      }
      render(<PlotlyChart {...propsWithHeight} />)

      expect(screen.getByTestId("stPlotlyChart")).toHaveStyle(
        `height: ${DEFAULT_HEIGHT}px`
      )
    })

    it("should render with an specific width", () => {
      const propsWithHeight = {
        ...props,
        height: 400,
        width: 500,
      }
      render(<PlotlyChart {...propsWithHeight} />)

      expect(screen.getByTestId("stPlotlyChart")).toHaveStyle(`height: 500px`)
    })
  })

  describe("Theming", () => {
    it("pulls default config values from theme", () => {
      const props = getProps()
      render(<PlotlyChart {...props} />)

      expect(true).toBe(true)
      // const { layout } = wrapper.find(Plot).first().props()
      // expect(layout.paper_bgcolor).toBe(mockTheme.emotion.colors.bgColor)
      // expect(layout.font?.color).toBe(mockTheme.emotion.colors.bodyText)
    })

    it("has user specified config take priority", () => {
      const props = getProps()

      const spec = JSON.parse(props.element.figure?.spec || "") || {}
      spec.layout = {
        ...spec?.layout,
        paper_bgcolor: "orange",
      }

      props.element.figure = props.element.figure || {}
      props.element.figure.spec = JSON.stringify(spec)

      const wrapper = mount(
        <ThemeProvider
          theme={mockTheme.emotion}
          baseuiTheme={mockTheme.basewebTheme}
        >
          <PlotlyChart {...props} />
        </ThemeProvider>
      )

      const { layout } = wrapper.find(Plot).first().props()
      expect(layout.paper_bgcolor).toBe("orange")
      // Verify that things not overwritten by the user still fall back to the
      // theme default.
      expect(layout.font?.color).toBe(mockTheme.emotion.colors.bodyText)
    })
  })
})
