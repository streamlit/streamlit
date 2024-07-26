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
import "@testing-library/jest-dom"

import { PlotlyChart as PlotlyChartProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"
import { applyStreamlitTheme, layoutWithThemeDefaults } from "./CustomTheme"
import {
  applyTheming,
  handleSelection,
  parseBoxSelection,
  parseLassoPath,
  sendEmptySelection,
} from "./PlotlyChart"

jest.mock("./CustomTheme", () => ({
  replaceTemporaryColors: jest.fn().mockReturnValue("{}"),
  applyStreamlitTheme: jest.fn(),
  layoutWithThemeDefaults: jest.fn().mockReturnValue({}),
}))

/**
 * PlotlyChart.test.tsx does not contain any React-testing-library tests because Plotly doesn't support it
 * https://github.com/plotly/react-plotly.js/issues/176
 */

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

const getWidgetMgr = (): WidgetStateManager => {
  const sendRerunBackMsg = jest.fn()
  const formsDataChanged = jest.fn()
  return new WidgetStateManager({
    sendRerunBackMsg,
    formsDataChanged,
  })
}

describe("sendEmptySelection", () => {
  it("sends a rerun msg if widget_state is empty", () => {
    const widgetMgr = getWidgetMgr()
    jest.spyOn(widgetMgr, "setStringValue")

    sendEmptySelection(
      widgetMgr,
      { id: "plotly_chart" } as PlotlyChartProto,
      undefined
    )

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("does not send a rerun msg if widget_state is empty", () => {
    const widgetMgr = getWidgetMgr()
    jest.spyOn(widgetMgr, "setStringValue")

    const plotlyProto = { id: "plotly_chart" } as PlotlyChartProto

    widgetMgr.setStringValue(
      plotlyProto,
      '{"selection":{"points":[],"point_indices":[],"box":[],"lasso":[]}}',
      { fromUi: true },
      undefined
    )

    sendEmptySelection(
      widgetMgr,
      { id: "plotly_chart" } as PlotlyChartProto,
      undefined
    )

    // setStringValue is not called again
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })
})

describe("handleSelection", () => {
  const mockFragmentId = "testFragment"
  const proto = {
    id: "plotly_chart",
    selectionMode: [0, 1, 2],
  } as PlotlyChartProto

  it("should return early if no event is provided", () => {
    const widgetMgr = getWidgetMgr()
    jest.spyOn(widgetMgr, "setStringValue")

    // @ts-expect-error
    handleSelection(undefined, widgetMgr, proto, mockFragmentId)
    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("should handle an event with no points or selections", () => {
    const event = { points: undefined, selections: undefined } as any
    const widgetMgr = getWidgetMgr()

    jest.spyOn(widgetMgr, "setStringValue")

    handleSelection(event, widgetMgr, proto, mockFragmentId)
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("should process events with points correctly", () => {
    const event = {
      points: [
        { pointIndex: 1, data: { legendgroup: "group1" }, pointIndices: [1] },
      ],
    } as any
    const widgetMgr = getWidgetMgr()

    jest.spyOn(widgetMgr, "setStringValue")

    handleSelection(event, widgetMgr, proto, mockFragmentId)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "plotly_chart", selectionMode: [0, 1, 2] },
      '{"selection":{"points":[{"point_index":1,"point_indices":[1],"legendgroup":"group1"}],"point_indices":[1],"box":[],"lasso":[]}}',
      { fromUi: true },
      "testFragment"
    )
  })

  it("should process box selections correctly", () => {
    const event = {
      selections: [
        {
          type: "rect",
          xref: "x",
          yref: "y",
          x0: "0",
          x1: "1",
          y0: "0",
          y1: "1",
        },
      ],
    } as any
    const widgetMgr = getWidgetMgr()

    jest.spyOn(widgetMgr, "setStringValue")

    handleSelection(event, widgetMgr, proto, undefined)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "plotly_chart", selectionMode: [0, 1, 2] },
      '{"selection":{"points":[],"point_indices":[],"box":[{"xref":"x","yref":"y","x":["0","1"],"y":["0","1"]}],"lasso":[]}}',
      { fromUi: true },
      undefined
    )
  })

  it("should process lasso selections correctly", () => {
    const event = {
      selections: [
        { type: "path", xref: "x", yref: "y", path: "M4.0,8.0L4.0,7.8Z" },
      ],
    } as any
    const widgetMgr = getWidgetMgr()

    jest.spyOn(widgetMgr, "setStringValue")

    handleSelection(event, widgetMgr, proto, mockFragmentId)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "plotly_chart", selectionMode: [0, 1, 2] },
      '{"selection":{"points":[],"point_indices":[],"box":[],"lasso":[{"xref":"x","yref":"y","x":[4,4],"y":[8,7.8]}]}}',
      { fromUi: true },
      "testFragment"
    )
  })

  it("should not rerun if lasso selection is present but has no lasso selection mode", () => {
    const event = {
      selections: [
        { type: "path", xref: "x", yref: "y", path: "M4.0,8.0L4.0,7.8Z" },
      ],
    } as any
    const widgetMgr = getWidgetMgr()

    jest.spyOn(widgetMgr, "setStringValue")

    handleSelection(
      event,
      widgetMgr,
      // @ts-expect-error
      { ...proto, selectionMode: [] },
      mockFragmentId
    )
    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("should not rerun if box selection is present but has no box selection mode", () => {
    const event = {
      selections: [
        {
          type: "rect",
          xref: "x",
          yref: "y",
          x0: "0",
          x1: "1",
          y0: "0",
          y1: "1",
        },
      ],
    } as any
    const widgetMgr = getWidgetMgr()

    jest.spyOn(widgetMgr, "setStringValue")

    handleSelection(
      event,
      widgetMgr,
      // @ts-expect-error
      { ...proto, selectionMode: [] },
      mockFragmentId
    )
    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("should not rerun if the return value is the same", () => {
    const event = {
      points: [],
      selections: [],
    } as any
    const widgetMgr = getWidgetMgr()

    jest.spyOn(widgetMgr, "setStringValue")

    widgetMgr.setStringValue(
      proto,
      '{"selection":{"points":[],"point_indices":[],"box":[],"lasso":[]}}',
      { fromUi: true },
      undefined
    )

    handleSelection(event, widgetMgr, proto, mockFragmentId)
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it('should rerun if there is a lasso select and a box select when selection_mode=["box", "lasso"]', () => {
    const boxEvent = {
      points: [
        {
          pointIndex: 0,
          data: { legendgroup: "group2" },
          pointIndices: [0],
          x: 0,
          y: 0,
        },
      ],
      selections: [
        {
          type: "rect",
          xref: "x",
          yref: "y",
          x0: "0",
          x1: "1",
          y0: "0",
          y1: "1",
        },
      ],
    } as any

    const widgetMgr = getWidgetMgr()

    jest.spyOn(widgetMgr, "setStringValue")
    handleSelection(
      boxEvent,
      widgetMgr,
      { ...proto, selectionMode: [1, 2] } as PlotlyChartProto,
      undefined
    )
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)

    const lassoEventAndBoxEvent = {
      points: [
        {
          pointIndex: 1,
          data: { legendgroup: "group1" },
          pointIndices: [1],
          x: 1,
          y: 1,
        },
        {
          pointIndex: 0,
          data: { legendgroup: "group2" },
          pointIndices: [0],
          x: 0,
          y: 0,
        },
      ],
      selections: [
        { type: "path", xref: "x", yref: "y", path: "M4.0,8.0L4.0,7Z" },
        {
          type: "rect",
          xref: "x",
          yref: "y",
          x0: "0",
          x1: "1",
          y0: "0",
          y1: "1",
        },
      ],
    } as any

    handleSelection(
      lassoEventAndBoxEvent,
      widgetMgr,
      { ...proto, selectionMode: [1, 2] } as PlotlyChartProto,
      undefined
    )
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(2)
    expect(widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      { id: "plotly_chart", selectionMode: [1, 2] },
      '{"selection":{"points":[{"point_index":1,"point_indices":[1],"x":1,"y":1,"legendgroup":"group1"},{"point_index":0,"point_indices":[0],"x":0,"y":0,"legendgroup":"group2"}],"point_indices":[1,0],"box":[{"xref":"x","yref":"y","x":["0","1"],"y":["0","1"]}],"lasso":[{"xref":"x","yref":"y","x":[4,4],"y":[8,7]}]}}',
      { fromUi: true },
      undefined
    )
  })
})

describe("applyTheming", () => {
  it("applies Streamlit theme when theme is streamlit", () => {
    const mockPlotlyFigure = { data: [{}], layout: {}, frames: [] }
    const chartTheme = "streamlit"

    applyTheming(mockPlotlyFigure, chartTheme, mockTheme.emotion)

    expect(applyStreamlitTheme).toHaveBeenCalled()
  })

  it("applies default theme when not using the default plotly theme", () => {
    const mockPlotlyFigure = { data: [{}], layout: {}, frames: [] }
    const chartTheme = "default"

    applyTheming(mockPlotlyFigure, chartTheme, mockTheme.emotion)

    expect(layoutWithThemeDefaults).toHaveBeenCalled()
  })
})
