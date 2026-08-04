/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { act, renderHook } from "@testing-library/react"
import { Mocked } from "vitest"

import { EChartsChart as EChartsChartProto } from "@streamlit/protobuf"

import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  EChartsSelectionInstance,
  useEChartsSelections,
} from "./useEChartsSelections"

const DEBOUNCE_TIME_MS = 150

interface FakeChart extends EChartsSelectionInstance {
  trigger: (event: string, params: unknown) => void
}

function createFakeChart(): Mocked<FakeChart> {
  const handlers: Record<string, (params: unknown) => void> = {}
  const chart = {
    on: vi.fn((event: string, handler: (params: unknown) => void) => {
      handlers[event] = handler
    }),
    off: vi.fn(),
    dispatchAction: vi.fn(),
    convertFromPixel: vi.fn(),
    getOption: vi.fn(() => ({})),
    trigger: (event: string, params: unknown) => {
      handlers[event]?.(params)
    },
  }
  return chart as unknown as Mocked<FakeChart>
}

/**
 * Build an element proto. A non-empty ``id`` marks the chart as a selection
 * widget (``on_select`` active); an empty ``id`` is a display-only chart.
 */
function createElement(id = "chart-id"): EChartsChartProto {
  return new EChartsChartProto({ id, formId: "" })
}

describe("useEChartsSelections", () => {
  let widgetMgr: Mocked<WidgetStateManager>

  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    widgetMgr = {
      getStringValue: vi.fn(),
      setStringValue: vi.fn(),
      getElementState: vi.fn(),
      setElementState: vi.fn(),
    } as unknown as Mocked<WidgetStateManager>
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  const flush = (): void => {
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_TIME_MS + 50)
    })
  }

  it("binds no handlers for display-only charts (empty id)", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(""), widgetMgr)
    )

    expect(result.current.isSelectionActivated).toBe(false)

    const chart = createFakeChart()
    let cleanup: () => void = () => {}
    act(() => {
      cleanup = result.current.bindSelections(chart)
    })

    expect(chart.on).not.toHaveBeenCalled()
    // Cleanup should be a safe no-op.
    act(() => {
      cleanup()
    })
    expect(chart.off).not.toHaveBeenCalled()
  })

  it("binds all selection listeners for a selection widget", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    expect(result.current.isSelectionActivated).toBe(true)

    const chart = createFakeChart()
    let cleanup: () => void = () => {}
    act(() => {
      cleanup = result.current.bindSelections(chart)
    })

    for (const event of [
      "selectchanged",
      "brushSelected",
      "brushEnd",
      "dblclick",
    ]) {
      expect(chart.on).toHaveBeenCalledWith(event, expect.any(Function))
    }

    act(() => {
      cleanup()
    })
    expect(chart.off).toHaveBeenCalledTimes(4)
  })

  it("leaves the widget's option untouched (no selection injection)", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const option = { series: [{ type: "bar", data: [1, 2, 3] }] }
    const configured = result.current.configureSelectionOption(option)

    // Streamlit does not inject selection config; the user owns it in the spec.
    expect(configured).toBe(option)
    expect(configured.brush).toBeUndefined()
    expect(configured.toolbox).toBeUndefined()
    const series = configured.series as Array<Record<string, unknown>>
    expect(series[0].selectedMode).toBeUndefined()
    expect(series[0].select).toBeUndefined()
  })

  it("writes point selection state on selectchanged (enriched from the option)", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const chart = createFakeChart()
    // selectchanged only reports indices; the point is enriched from the option.
    chart.getOption.mockReturnValue({
      series: [
        { type: "bar", name: "Sales", data: [10, 20, 30, 40, 50, 60, 61, 80] },
      ],
    })
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      chart.trigger("selectchanged", {
        fromAction: "select",
        isFromClick: true,
        selected: [{ seriesIndex: 0, dataIndex: [7] }],
      })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "chart-id", formId: "" },
      JSON.stringify({
        selection: {
          points: [
            {
              component_type: "series",
              series_type: "bar",
              series_index: 0,
              series_name: "Sales",
              data_index: 7,
              value: 80,
              data: 80,
            },
          ],
          point_indices: [7],
          box: [],
          lasso: [],
        },
      }),
      { fromUi: true },
      undefined
    )
  })

  it("persists selected points for visual restore without clearing the brush", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const chart = createFakeChart()
    act(() => {
      result.current.bindSelections(chart)
    })

    const selected = [{ seriesIndex: 0, dataIndex: [2] }]
    act(() => {
      chart.trigger("selectchanged", {
        fromAction: "select",
        isFromClick: true,
        selected,
      })
    })
    flush()

    // The raw selection is persisted so it can be re-applied visually.
    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "selectedPoints",
      selected
    )
    // Must NOT happen: selecting a point does not clear the (coexisting) brush.
    expect(widgetMgr.setElementState).not.toHaveBeenCalledWith(
      "chart-id",
      "brushAreas",
      []
    )
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("writes an empty selection when the last point is deselected", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const chart = createFakeChart()
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      chart.trigger("selectchanged", {
        fromAction: "unselect",
        isFromClick: true,
        selected: [],
      })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "chart-id", formId: "" },
      JSON.stringify({
        selection: { points: [], point_indices: [], box: [], lasso: [] },
      }),
      { fromUi: true },
      undefined
    )
  })

  it.each([
    ["brushSelected first", ["brushSelected", "brushEnd"] as const],
    ["brushEnd first", ["brushEnd", "brushSelected"] as const],
  ])(
    "emits a single box selection update regardless of event order (%s)",
    (_label, order) => {
      const { result } = renderHook(() =>
        useEChartsSelections(createElement(), widgetMgr)
      )

      const chart = createFakeChart()
      act(() => {
        result.current.bindSelections(chart)
      })

      const events: Record<string, unknown> = {
        brushSelected: {
          batch: [{ selected: [{ seriesIndex: 0, dataIndex: [1, 2] }] }],
        },
        brushEnd: {
          areas: [
            {
              brushType: "rect",
              coordRange: [
                [0, 2],
                [10, 20],
              ],
              xAxisIndex: 0,
            },
          ],
        },
      }

      act(() => {
        for (const eventName of order) {
          chart.trigger(eventName, events[eventName])
        }
      })
      flush()

      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
      expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
        { id: "chart-id", formId: "" },
        JSON.stringify({
          selection: {
            points: [
              { component_type: "series", series_index: 0, data_index: 1 },
              { component_type: "series", series_index: 0, data_index: 2 },
            ],
            point_indices: [1, 2],
            box: [{ x: [0, 2], y: [10, 20], grid_index: 0 }],
            lasso: [],
          },
        }),
        { fromUi: true },
        undefined
      )
    }
  )

  it("emits a lasso selection for polygon brushes", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const chart = createFakeChart()
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      chart.trigger("brushSelected", { batch: [{ selected: [] }] })
      chart.trigger("brushEnd", {
        areas: [
          {
            brushType: "polygon",
            coordRange: [
              [0, 0],
              [1, 1],
              [2, 0],
            ],
            xAxisIndex: 0,
          },
        ],
      })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "chart-id", formId: "" },
      JSON.stringify({
        selection: {
          points: [],
          point_indices: [],
          box: [],
          lasso: [{ x: [0, 1, 2], y: [0, 1, 0], grid_index: 0 }],
        },
      }),
      { fromUi: true },
      undefined
    )
  })

  it("emits the de-duplicated union of coexisting point and brush selections", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ type: "bar", name: "Sales", data: [10, 20, 30] }],
    })
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      // Natively select data point 1.
      chart.trigger("selectchanged", {
        fromAction: "select",
        isFromClick: true,
        selected: [{ seriesIndex: 0, dataIndex: [1] }],
      })
      // Brush a region covering points 1 (overlaps the native selection) and 2.
      chart.trigger("brushSelected", {
        batch: [{ selected: [{ seriesIndex: 0, dataIndex: [1, 2] }] }],
      })
      chart.trigger("brushEnd", {
        areas: [
          {
            brushType: "rect",
            coordRange: [
              [0, 2],
              [10, 20],
            ],
            xAxisIndex: 0,
          },
        ],
      })
    })
    flush()

    // A single combined update: point 1 appears once (native entry wins over the
    // brushed duplicate), point 2 comes from the brush, and the box geometry is
    // carried alongside.
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "chart-id", formId: "" },
      JSON.stringify({
        selection: {
          points: [
            {
              component_type: "series",
              series_type: "bar",
              series_index: 0,
              series_name: "Sales",
              data_index: 1,
              value: 20,
              data: 20,
            },
            { component_type: "series", series_index: 0, data_index: 2 },
          ],
          point_indices: [1, 2],
          box: [{ x: [0, 2], y: [10, 20], grid_index: 0 }],
          lasso: [],
        },
      }),
      { fromUi: true },
      undefined
    )
  })

  it("writes an empty selection when a brush is cleared", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const chart = createFakeChart()
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      chart.trigger("brushSelected", { batch: [] })
      chart.trigger("brushEnd", { areas: [] })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "chart-id", formId: "" },
      JSON.stringify({
        selection: { points: [], point_indices: [], box: [], lasso: [] },
      }),
      { fromUi: true },
      undefined
    )
  })

  it("skips no-op widget updates", () => {
    const identicalState = JSON.stringify({
      selection: {
        points: [
          {
            component_type: "series",
            series_type: "bar",
            series_index: 0,
            series_name: "Sales",
            data_index: 3,
            name: "Thu",
            value: 80,
            data: { name: "Thu", value: 80 },
          },
        ],
        point_indices: [3],
        box: [],
        lasso: [],
      },
    })
    widgetMgr.getStringValue.mockReturnValue(identicalState)

    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [
        {
          type: "bar",
          name: "Sales",
          data: [0, 0, 0, { name: "Thu", value: 80 }],
        },
      ],
    })
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      chart.trigger("selectchanged", {
        fromAction: "select",
        isFromClick: true,
        selected: [{ seriesIndex: 0, dataIndex: [3] }],
      })
    })
    flush()

    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("clears the selection on double-click", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const chart = createFakeChart()
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      chart.trigger("dblclick", {})
    })
    flush()

    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      areas: [],
    })
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "chart-id", formId: "" },
      JSON.stringify({
        selection: { points: [], point_indices: [], box: [], lasso: [] },
      }),
      { fromUi: true },
      undefined
    )
  })

  it("unselects persisted points when clearing via double-click", () => {
    const selectedPoints = [{ seriesIndex: 0, dataIndex: [2] }]
    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "selectedPoints" ? selectedPoints : undefined
    )

    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const chart = createFakeChart()
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      chart.trigger("dblclick", {})
    })
    flush()

    // Persisted native points are explicitly unselected (not just cleared from
    // state), so the visible highlight is removed.
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "unselect",
      seriesIndex: 0,
      dataIndex: [2],
    })
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      areas: [],
    })
    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "selectedPoints",
      []
    )
  })

  it("resets the selection state when the form is cleared", () => {
    widgetMgr.getStringValue.mockReturnValue(
      JSON.stringify({
        selection: { points: [{ data_index: 1 }], point_indices: [1] },
      })
    )

    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    act(() => {
      result.current.onFormCleared()
    })

    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "chart-id", formId: "" },
      JSON.stringify({
        selection: { points: [], point_indices: [], box: [], lasso: [] },
      }),
      { fromUi: true },
      undefined
    )
  })

  it("restoreSelection re-applies persisted points and brush areas", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const selectedPoints = [{ seriesIndex: 0, dataIndex: [1, 3] }]
    const brushAreas = [
      {
        brushType: "rect",
        range: [
          [0, 1],
          [2, 3],
        ],
      },
    ]
    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "selectedPoints" ? selectedPoints : brushAreas
    )

    const chart = createFakeChart()
    act(() => {
      result.current.restoreSelection(chart)
    })

    // The persisted point selection is re-dispatched as a native select action.
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "select",
      seriesIndex: 0,
      dataIndex: [1, 3],
    })
    // The persisted brush areas are re-drawn.
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      areas: brushAreas,
    })
  })

  it("seeds native points on bind so a post-remount brush keeps them", () => {
    // Simulate a remount that had a persisted native point selection: after a
    // theme/renderer change the caches would otherwise start empty.
    const persistedPoints = [{ seriesIndex: 0, dataIndex: [1] }]
    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "selectedPoints" ? persistedPoints : undefined
    )

    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ type: "bar", name: "Sales", data: [10, 20, 30] }],
    })
    act(() => {
      result.current.bindSelections(chart)
    })

    // The user draws a NEW brush over point 2 only (no selectchanged fires).
    act(() => {
      chart.trigger("brushSelected", {
        batch: [{ selected: [{ seriesIndex: 0, dataIndex: [2] }] }],
      })
      chart.trigger("brushEnd", {
        areas: [
          {
            brushType: "rect",
            coordRange: [
              [0, 2],
              [10, 20],
            ],
            xAxisIndex: 0,
          },
        ],
      })
    })
    flush()

    // The persisted native point (1) is preserved in the union alongside the
    // newly brushed point (2) rather than being dropped.
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "chart-id", formId: "" },
      JSON.stringify({
        selection: {
          points: [
            {
              component_type: "series",
              series_type: "bar",
              series_index: 0,
              series_name: "Sales",
              data_index: 1,
              value: 20,
              data: 20,
            },
            { component_type: "series", series_index: 0, data_index: 2 },
          ],
          point_indices: [1, 2],
          box: [{ x: [0, 2], y: [10, 20], grid_index: 0 }],
          lasso: [],
        },
      }),
      { fromUi: true },
      undefined
    )
  })

  it("seeds brush geometry on bind so a post-remount point selection keeps the box", () => {
    // Simulate a remount that had a persisted brush selection.
    const persistedAreas = [
      {
        brushType: "rect",
        coordRange: [
          [0, 2],
          [10, 20],
        ],
        xAxisIndex: 0,
      },
    ]
    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "brushAreas" ? persistedAreas : undefined
    )

    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )

    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ type: "bar", name: "Sales", data: [10, 20, 30] }],
    })
    act(() => {
      result.current.bindSelections(chart)
    })

    // The user selects a NEW point (no brush event fires).
    act(() => {
      chart.trigger("selectchanged", {
        fromAction: "select",
        isFromClick: true,
        selected: [{ seriesIndex: 0, dataIndex: [0] }],
      })
    })
    flush()

    // The persisted brush geometry is preserved rather than being cleared by the
    // point-only interaction.
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "chart-id", formId: "" },
      JSON.stringify({
        selection: {
          points: [
            {
              component_type: "series",
              series_type: "bar",
              series_index: 0,
              series_name: "Sales",
              data_index: 0,
              value: 10,
              data: 10,
            },
          ],
          point_indices: [0],
          box: [{ x: [0, 2], y: [10, 20], grid_index: 0 }],
          lasso: [],
        },
      }),
      { fromUi: true },
      undefined
    )
  })

  it("resets the series cursor to default for display-only charts", () => {
    // An empty id makes the chart display-only (no selection).
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(""), widgetMgr)
    )
    expect(result.current.isSelectionActivated).toBe(false)

    const configured = result.current.configureSelectionOption({
      series: [
        { type: "bar", data: [1] },
        { type: "line", data: [2] },
      ],
    })
    const series = configured.series as Array<Record<string, unknown>>
    expect(series[0].cursor).toBe("default")
    expect(series[1].cursor).toBe("default")

    // A single series object (not an array) is handled too.
    const single = result.current.configureSelectionOption({
      series: { type: "pie", data: [] },
    })
    expect((single.series as Record<string, unknown>).cursor).toBe("default")
  })

  it("preserves an explicit series cursor on display-only charts", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(""), widgetMgr)
    )

    const configured = result.current.configureSelectionOption({
      series: [{ type: "bar", data: [1], cursor: "crosshair" }],
    })
    const series = configured.series as Array<Record<string, unknown>>
    expect(series[0].cursor).toBe("crosshair")
  })
})
