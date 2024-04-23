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
import { render } from "@streamlit/lib/src/test_util"

import { PlotlyChart as PlotlyChartProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import mock from "./mock"

import {
  PlotlyChart,
  DEFAULT_HEIGHT,
  PlotlyChartProps,
  parseLassoPath,
  parseBoxSelection,
} from "./PlotlyChart"

const getProps = (
  elementProps: Partial<PlotlyChartProto> = {}
): PlotlyChartProps => ({
  element: PlotlyChartProto.create({
    ...mock,
    ...elementProps,
  }),
  width: 0,
  height: 0,
  isFullScreen: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
  disabled: false,
})

// eslint-disable-next-line testing-library/no-node-access -- There's no other way to get the parent element
const getParent = (wrapper: Element): Element | null => wrapper.parentElement

const getPlotlyRoot = (wrapper: Element): Element | null => {
  let root = getParent(wrapper)
  while (root && !root.classList.contains("stPlotlyChart")) {
    root = getParent(root)
  }
  return root
}

describe("PlotlyChart Element", () => {
  it("renders without crashing", async () => {
    const props = getProps()
    render(<PlotlyChart {...props} />)
    await new Promise(process.nextTick)

    // Group 1 is just a label
    expect(screen.getByText("Group 1")).toBeInTheDocument()
  })

  describe("Theming", () => {
    it("pulls default config values from theme", async () => {
      const props = getProps()
      render(<PlotlyChart {...props} />)
      await new Promise(process.nextTick)

      const label = screen.getByText("Group 1")
      // Verify that things not overwritten by the user still fall back to the
      // theme default. Note that labels are converted from hex to rgb.
      expect(label).toHaveStyle("fill: rgb(49, 51, 63)")

      // eslint-disable-next-line testing-library/no-node-access -- There's no other way to get the SVG
      const svg = getPlotlyRoot(label)?.querySelector("svg")
      // Note that labels are converted from hex to rgb.
      expect(svg).toHaveStyle("background: rgb(255, 255, 255)")
    })
    it("has user specified config take priority", async () => {
      const props = getProps()
      const spec = JSON.parse(props.element.figure?.spec || "") || {}
      spec.layout = {
        ...spec?.layout,
        paper_bgcolor: "orange",
      }
      props.element.figure = props.element.figure || {}
      props.element.figure.spec = JSON.stringify(spec)
      render(<PlotlyChart {...props} />)
      await new Promise(process.nextTick)

      const label = screen.getByText("Group 1")
      // Verify that things not overwritten by the user still fall back to the
      // theme default. Note that labels are converted from hex to rgb.
      expect(label).toHaveStyle("fill: rgb(49, 51, 63)")

      // eslint-disable-next-line testing-library/no-node-access -- There's no other way to get the SVG
      const svg = getPlotlyRoot(label)?.querySelector("svg")
      expect(svg).toHaveStyle("background: orange")
    })
  })

  describe("parsePlotlySelections", () => {
    describe("parseLassoPath", () => {
      it("parses a simple lasso path string into x and y coordinates", () => {
        const pathData = "M100,150L200,250L300,350Z"
        const result = parseLassoPath(pathData)
        expect(result).toEqual({
          x: [100, 200, 300],
          y: [150, 250, 350],
        })
      })

      it("does not error with an empty string", () => {
        const result = parseLassoPath("")
        expect(result).toEqual({
          x: [],
          y: [],
        })
      })

      it("handles path with only one point", () => {
        const pathData = "M100,150Z"
        const result = parseLassoPath(pathData)
        expect(result).toEqual({
          x: [100],
          y: [150],
        })
      })
    })

    describe("parseBoxSelection", () => {
      it("parses a box selection into x and y ranges", () => {
        const selection = { x0: 100, y0: 150, x1: 200, y1: 250 }
        const result = parseBoxSelection(selection)
        expect(result).toEqual({
          x: [100, 200],
          y: [150, 250],
        })
      })

      it("returns an object of empty x and y", () => {
        const selection = {}
        const result = parseBoxSelection(selection)
        expect(result).toEqual({
          x: [],
          y: [],
        })
      })
    })
  })
})
