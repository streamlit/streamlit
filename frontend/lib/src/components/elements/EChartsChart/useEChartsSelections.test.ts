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
    trigger: (event: string, params: unknown) => {
      handlers[event]?.(params)
    },
  }
  return chart as unknown as Mocked<FakeChart>
}

function createElement(
  selectionMode: EChartsChartProto.SelectionMode[],
  id = "chart-id"
): EChartsChartProto {
  return new EChartsChartProto({
    id,
    formId: "",
    selectionMode,
  })
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
      useEChartsSelections(
        createElement([EChartsChartProto.SelectionMode.POINTS], ""),
        widgetMgr
      )
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

  it("writes point selection state on a series click", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(
        createElement([EChartsChartProto.SelectionMode.POINTS]),
        widgetMgr
      )
    )

    const chart = createFakeChart()
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      chart.trigger("click", {
        componentType: "series",
        seriesType: "bar",
        seriesIndex: 0,
        seriesName: "Sales",
        dataIndex: 3,
        name: "Thu",
        value: 80,
        data: 80,
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
              data_index: 3,
              name: "Thu",
              value: 80,
              data: 80,
            },
          ],
          point_indices: [3],
          box: [],
          lasso: [],
        },
      }),
      { fromUi: true },
      undefined
    )
  })

  it("clears persisted brush areas when a point is clicked", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(
        createElement([
          EChartsChartProto.SelectionMode.POINTS,
          EChartsChartProto.SelectionMode.BOX,
        ]),
        widgetMgr
      )
    )

    const chart = createFakeChart()
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      chart.trigger("click", {
        componentType: "series",
        seriesIndex: 0,
        dataIndex: 2,
      })
    })
    flush()

    // A point click resets the persisted brush areas so a later restore can't
    // resurrect a stale box/lasso that disagrees with the points-only state.
    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "brushAreas",
      []
    )
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("ignores clicks on non-series components", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(
        createElement([EChartsChartProto.SelectionMode.POINTS]),
        widgetMgr
      )
    )

    const chart = createFakeChart()
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      chart.trigger("click", { componentType: "xAxis", dataIndex: 1 })
    })
    flush()

    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it.each([
    ["brushSelected first", ["brushSelected", "brushEnd"] as const],
    ["brushEnd first", ["brushEnd", "brushSelected"] as const],
  ])(
    "emits a single box selection update regardless of event order (%s)",
    (_label, order) => {
      const { result } = renderHook(() =>
        useEChartsSelections(
          createElement([
            EChartsChartProto.SelectionMode.BOX,
            EChartsChartProto.SelectionMode.LASSO,
          ]),
          widgetMgr
        )
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
      useEChartsSelections(
        createElement([EChartsChartProto.SelectionMode.LASSO]),
        widgetMgr
      )
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

  it("writes an empty selection when a brush is cleared", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(
        createElement([EChartsChartProto.SelectionMode.BOX]),
        widgetMgr
      )
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
            series_name: undefined,
            data_index: 3,
            name: undefined,
            value: undefined,
            data: undefined,
          },
        ],
        point_indices: [3],
        box: [],
        lasso: [],
      },
    })
    widgetMgr.getStringValue.mockReturnValue(identicalState)

    const { result } = renderHook(() =>
      useEChartsSelections(
        createElement([EChartsChartProto.SelectionMode.POINTS]),
        widgetMgr
      )
    )

    const chart = createFakeChart()
    act(() => {
      result.current.bindSelections(chart)
    })

    act(() => {
      chart.trigger("click", {
        componentType: "series",
        seriesType: "bar",
        seriesIndex: 0,
        dataIndex: 3,
      })
    })
    flush()

    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("clears the selection on double-click", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(
        createElement([EChartsChartProto.SelectionMode.BOX]),
        widgetMgr
      )
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

  it("resets the selection state when the form is cleared", () => {
    widgetMgr.getStringValue.mockReturnValue(
      JSON.stringify({
        selection: { points: [{ data_index: 1 }], point_indices: [1] },
      })
    )

    const { result } = renderHook(() =>
      useEChartsSelections(
        createElement([EChartsChartProto.SelectionMode.POINTS]),
        widgetMgr
      )
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

  it("configures brush and toolbox for box/lasso modes without clobbering user config", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(
        createElement([
          EChartsChartProto.SelectionMode.BOX,
          EChartsChartProto.SelectionMode.LASSO,
        ]),
        widgetMgr
      )
    )

    const configured = result.current.configureSelectionOption({
      series: [{ type: "bar", data: [1, 2, 3] }],
    })

    expect(configured.brush).toBeDefined()
    expect(configured.toolbox).toEqual({
      feature: { brush: { type: ["rect", "polygon", "clear"] } },
    })

    // A user-provided brush must be preserved untouched.
    const userBrush = { toolbox: ["rect"] }
    const withUserBrush = result.current.configureSelectionOption({
      brush: userBrush,
    })
    expect(withUserBrush.brush).toBe(userBrush)
  })

  it("does not add brush config for points-only selections", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(
        createElement([EChartsChartProto.SelectionMode.POINTS]),
        widgetMgr
      )
    )

    const option = { series: [{ type: "bar", data: [1] }] }
    const configured = result.current.configureSelectionOption(option)
    expect(configured).toBe(option)
    expect(configured.brush).toBeUndefined()
    // A clickable (selection) chart keeps ECharts' default pointer cursor.
    const series = configured.series as Array<Record<string, unknown>>
    expect(series[0].cursor).toBeUndefined()
  })

  it("resets the series cursor to default for display-only charts", () => {
    // An empty id makes the chart display-only (no selection).
    const { result } = renderHook(() =>
      useEChartsSelections(
        createElement([EChartsChartProto.SelectionMode.POINTS], ""),
        widgetMgr
      )
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
      useEChartsSelections(
        createElement([EChartsChartProto.SelectionMode.POINTS], ""),
        widgetMgr
      )
    )

    const configured = result.current.configureSelectionOption({
      series: [{ type: "bar", data: [1], cursor: "crosshair" }],
    })
    const series = configured.series as Array<Record<string, unknown>>
    expect(series[0].cursor).toBe("crosshair")
  })
})
