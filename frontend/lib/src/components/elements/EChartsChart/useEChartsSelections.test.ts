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
import { Mock, Mocked } from "vitest"

import { EChartsChart as EChartsChartProto } from "@streamlit/protobuf"

import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  EChartsSelectionInstance,
  useEChartsSelections,
} from "./useEChartsSelections"

const DEBOUNCE_TIME_MS = 150
const WRITE_OPTIONS = {
  formId: "",
  fragmentId: undefined,
  fromUser: true,
}

interface FakeChart extends EChartsSelectionInstance {
  zr: { on: Mock; off: Mock }
  trigger: (event: string, params: unknown) => void
}

interface TestSelectedEntry {
  seriesIndex: number
  dataType?: string
  dataIndex: number[]
}

interface TestBrushArea {
  brushType: string
  coordRange?: unknown
  range?: unknown
  [key: string]: unknown
}

interface TestBrushSelection {
  brushId: string
  brushIndex: number
  areas: TestBrushArea[]
  selected: TestSelectedEntry[]
}

function createFakeChart(): Mocked<FakeChart> {
  // Chart-level and zrender-level handlers share a registry so tests can
  // trigger either layer through the same helper.
  const handlers: Record<string, (params: unknown) => void> = {}
  const record =
    () =>
    (event: string, handler: (params: unknown) => void): void => {
      handlers[event] = handler
    }
  const chart = {
    on: vi.fn(record()),
    off: vi.fn(),
    zr: { on: vi.fn(record()), off: vi.fn() },
    getZr: vi.fn(() => chart.zr),
    isDisposed: vi.fn(() => false),
    dispatchAction: vi.fn(),
    getOption: vi.fn(() => ({})),
    trigger: (event: string, params: unknown) => {
      handlers[event]?.(params)
    },
  }
  return chart as unknown as Mocked<FakeChart>
}

function createElement(id = "chart-id", formId = ""): EChartsChartProto {
  return new EChartsChartProto({ id, formId })
}

function emptySelectedPlaceholders(): TestSelectedEntry[] {
  return [
    { seriesIndex: 0, dataIndex: [] },
    { seriesIndex: 0, dataType: "node", dataIndex: [] },
    { seriesIndex: 0, dataType: "edge", dataIndex: [] },
    { seriesIndex: 1, dataIndex: [] },
  ]
}

function selectedWithMainHits(
  dataIndex: number[],
  seriesIndex = 0
): TestSelectedEntry[] {
  return [
    { seriesIndex, dataIndex },
    ...emptySelectedPlaceholders().filter(
      entry =>
        entry.seriesIndex !== seriesIndex || entry.dataType !== undefined
    ),
  ]
}

function createBrushSelection({
  brushId = "brush-0",
  brushIndex = 0,
  areas,
  selected = emptySelectedPlaceholders(),
}: {
  brushId?: string
  brushIndex?: number
  areas: TestBrushArea[]
  selected?: TestSelectedEntry[]
}): TestBrushSelection {
  return { brushId, brushIndex, areas, selected }
}

function triggerBrushGesture(
  chart: Mocked<FakeChart>,
  brush: TestBrushSelection,
  order:
    | readonly ["brushSelected", "brushEnd"]
    | readonly ["brushEnd", "brushSelected"] = ["brushSelected", "brushEnd"]
): void {
  const events = {
    brushSelected: { batch: [brush] },
    brushEnd: { brushId: brush.brushId, areas: brush.areas },
  }
  for (const eventName of order) {
    chart.trigger(eventName, events[eventName])
  }
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

  const expectSelectionWrite = (
    selected: unknown[],
    areas: unknown[],
    callNumber = 1
  ): void => {
    expect(widgetMgr.setStringValue).toHaveBeenNthCalledWith(
      callNumber,
      "chart-id",
      JSON.stringify({ selection: { selected, areas } }),
      WRITE_OPTIONS
    )
  }

  it("binds no handlers for display-only or disabled charts", () => {
    const { result: displayResult } = renderHook(() =>
      useEChartsSelections(createElement(""), widgetMgr)
    )
    const displayChart = createFakeChart()
    let cleanup: () => void = () => {}

    act(() => {
      cleanup = displayResult.current.bindSelections(displayChart)
    })

    expect(displayResult.current.isSelectionActivated).toBe(false)
    expect(displayChart.on).not.toHaveBeenCalled()
    act(() => {
      cleanup()
    })
    expect(displayChart.off).not.toHaveBeenCalled()

    const { result: disabledResult } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr, undefined, true)
    )
    const disabledChart = createFakeChart()
    act(() => {
      disabledResult.current.bindSelections(disabledChart)
    })

    expect(disabledResult.current.isSelectionActivated).toBe(false)
    expect(disabledChart.on).not.toHaveBeenCalled()
  })

  it("binds and cleans up all selection listeners", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    let cleanup: () => void = () => {}

    act(() => {
      cleanup = result.current.bindSelections(chart)
    })

    expect(result.current.isSelectionActivated).toBe(true)
    for (const event of ["selectchanged", "brushSelected", "brushEnd"]) {
      expect(chart.on).toHaveBeenCalledWith(event, expect.any(Function))
    }
    expect(chart.on).not.toHaveBeenCalledWith("dblclick", expect.any(Function))
    expect(chart.zr.on).toHaveBeenCalledWith("dblclick", expect.any(Function))

    act(() => {
      cleanup()
    })

    expect(chart.off).toHaveBeenCalledTimes(3)
    expect(chart.zr.off).toHaveBeenCalledWith("dblclick", expect.any(Function))
  })

  it("skips listener cleanup after the chart is disposed", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    let cleanup: () => void = () => {}
    act(() => {
      cleanup = result.current.bindSelections(chart)
    })

    chart.isDisposed.mockReturnValue(true)
    act(() => {
      cleanup()
    })

    expect(chart.off).not.toHaveBeenCalled()
    expect(chart.zr.off).not.toHaveBeenCalled()
  })

  it("leaves a selection widget option untouched", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const option = { series: [{ type: "bar", data: [1, 2, 3] }] }

    const configured = result.current.configureSelectionOption(option)

    expect(configured).toBe(option)
    expect(configured.brush).toBeUndefined()
    expect(configured.toolbox).toBeUndefined()
    const series = configured.series as Array<Record<string, unknown>>
    expect(series[0].selectedMode).toBeUndefined()
    expect(series[0].select).toBeUndefined()
  })

  it("uses a default cursor only for display-only series without one", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(""), widgetMgr)
    )

    const configured = result.current.configureSelectionOption({
      series: [
        { type: "bar", data: [1] },
        { type: "line", data: [2], cursor: "crosshair" },
      ],
    })
    const series = configured.series as Array<Record<string, unknown>>
    expect(series[0].cursor).toBe("default")
    expect(series[1].cursor).toBe("crosshair")

    const single = result.current.configureSelectionOption({
      series: { type: "pie", data: [] },
    })
    expect((single.series as Record<string, unknown>).cursor).toBe("default")

    const noSeries = {}
    expect(result.current.configureSelectionOption(noSeries)).toBe(noSeries)
  })

  it("reports explicit series metadata and sanitizes invalid metadata", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [
        { id: "sales-id", name: "Sales" },
        { id: 42, name: 7 },
        { id: "bad\0id", name: "bad\0name" },
        { id: "", name: null },
      ],
    })
    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("selectchanged", {
        selected: [
          { seriesIndex: 0, dataIndex: [4] },
          { seriesIndex: 1, dataIndex: [3] },
          { seriesIndex: 2, dataIndex: [2] },
          { seriesIndex: 3, dataIndex: [1] },
        ],
      })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: "sales-id",
          series_name: "Sales",
          data_type: "main",
          data_indices: [4],
        },
        {
          series_index: 1,
          series_id: 42,
          series_name: 7,
          data_type: "main",
          data_indices: [3],
        },
        {
          series_index: 2,
          series_id: null,
          series_name: null,
          data_type: "main",
          data_indices: [2],
        },
        {
          series_index: 3,
          series_id: null,
          series_name: null,
          data_type: "main",
          data_indices: [1],
        },
      ],
      []
    )
  })

  it("groups selections deterministically and sorts and deduplicates indices", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [
        { id: "graph", name: "Graph" },
        { id: "other", name: "Other" },
      ],
    })
    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("selectchanged", {
        selected: [
          { seriesIndex: 0, dataType: "node", dataIndex: [3, 1, 3] },
          { seriesIndex: 1, dataType: "edge", dataIndex: [9, 2, 9] },
          { seriesIndex: 0, dataType: "edge", dataIndex: [4] },
          { seriesIndex: 0, dataIndex: [8, 2] },
          { seriesIndex: 0, dataType: "main", dataIndex: [5, 2] },
        ],
      })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: "graph",
          series_name: "Graph",
          data_type: "main",
          data_indices: [2, 5, 8],
        },
        {
          series_index: 0,
          series_id: "graph",
          series_name: "Graph",
          data_type: "node",
          data_indices: [1, 3],
        },
        {
          series_index: 0,
          series_id: "graph",
          series_name: "Graph",
          data_type: "edge",
          data_indices: [4],
        },
        {
          series_index: 1,
          series_id: "other",
          series_name: "Other",
          data_type: "edge",
          data_indices: [2, 9],
        },
      ],
      []
    )
  })

  it("persists native points without clearing the brush cache", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    const selected = [{ seriesIndex: 0, dataIndex: [2] }]
    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("selectchanged", { selected })
    })
    flush()

    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "selectedPoints",
      selected
    )
    expect(widgetMgr.setElementState).not.toHaveBeenCalledWith(
      "chart-id",
      "brushSelection",
      []
    )
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("emits the deduplicated union of native and brush selections", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [
        { id: "sales", name: "Sales" },
        { id: "costs", name: "Costs" },
      ],
    })
    const area = {
      brushType: "rect",
      coordRange: [
        [0, 2],
        [10, 20],
      ],
      xAxisIndex: 0,
    }
    const brush = createBrushSelection({
      areas: [area],
      selected: selectedWithMainHits([3, 2]),
    })

    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [3, 1] }],
      })
      triggerBrushGesture(chart, brush)
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: "sales",
          series_name: "Sales",
          data_type: "main",
          data_indices: [1, 2, 3],
        },
      ],
      [
        {
          brush_index: 0,
          brush_type: "rect",
          coord_range: area.coordRange,
        },
      ]
    )
  })

  it("orders areas by brush index while preserving component area order", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    const polygon = {
      brushType: "polygon",
      coordRange: [
        [0, 0],
        [1, 1],
        [2, 0],
      ],
    }
    const line = { brushType: "lineX", coordRange: [2, 4] }
    const zeroHitArea = {
      brushType: "rect",
      coordRange: [
        [5, 6],
        [7, 8],
      ],
    }
    const pixelOnlyArea = {
      brushType: "rect",
      range: [
        [10, 20],
        [30, 40],
      ],
    }
    const brush2 = createBrushSelection({
      brushId: "brush-2",
      brushIndex: 2,
      areas: [pixelOnlyArea],
    })
    const brush0 = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [polygon, line],
    })
    const brush1 = createBrushSelection({
      brushId: "brush-1",
      brushIndex: 1,
      areas: [zeroHitArea],
    })

    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("brushSelected", {
        batch: [brush2, brush0, brush1],
      })
      chart.trigger("brushEnd", {
        brushId: brush1.brushId,
        areas: brush1.areas,
      })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [],
      [
        {
          brush_index: 0,
          brush_type: "polygon",
          coord_range: polygon.coordRange,
        },
        {
          brush_index: 0,
          brush_type: "lineX",
          coord_range: line.coordRange,
        },
        {
          brush_index: 1,
          brush_type: "rect",
          coord_range: zeroHitArea.coordRange,
        },
        {
          brush_index: 2,
          brush_type: "rect",
          coord_range: null,
        },
      ]
    )
  })

  it.each([
    ["brushSelected first", ["brushSelected", "brushEnd"] as const],
    ["brushEnd first", ["brushEnd", "brushSelected"] as const],
  ])(
    "commits one update in either ECharts event order (%s)",
    (_name, order) => {
      const { result } = renderHook(() =>
        useEChartsSelections(createElement(), widgetMgr)
      )
      const chart = createFakeChart()
      const area = {
        brushType: "rect",
        coordRange: [
          [0, 2],
          [10, 20],
        ],
      }
      const brush = createBrushSelection({
        brushId: "brush-order",
        brushIndex: 3,
        areas: [area],
        selected: selectedWithMainHits([2, 1]),
      })
      act(() => {
        result.current.bindSelections(chart)
        triggerBrushGesture(chart, brush, order)
      })
      flush()

      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
      expectSelectionWrite(
        [
          {
            series_index: 0,
            series_id: null,
            series_name: null,
            data_type: "main",
            data_indices: [1, 2],
          },
        ],
        [
          {
            brush_index: 3,
            brush_type: "rect",
            coord_range: area.coordRange,
          },
        ]
      )
    }
  )

  it("matches brushEnd geometry against model-enriched brush areas", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    const eventArea = {
      brushType: "rect",
      panelId: "grid--generated-id",
      range: [
        [10, 20],
        [30, 40],
      ],
      coordRange: [
        [0, 1],
        [2, 3],
      ],
    }
    const modelArea = {
      ...eventArea,
      brushMode: "single",
      transformable: true,
      brushStyle: { color: "red" },
    }
    const brush = createBrushSelection({
      areas: [modelArea],
      selected: selectedWithMainHits([1]),
    })

    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("brushSelected", { batch: [brush] })
      chart.trigger("brushEnd", {
        brushId: brush.brushId,
        areas: [eventArea],
      })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: null,
          series_name: null,
          data_type: "main",
          data_indices: [1],
        },
      ],
      [
        {
          brush_index: 0,
          brush_type: "rect",
          coord_range: eventArea.coordRange,
        },
      ]
    )
  })

  it("waits for brushEnd before committing a non-empty brush snapshot", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    const brush = createBrushSelection({
      areas: [{ brushType: "lineX", coordRange: [1, 3] }],
      selected: selectedWithMainHits([1, 2]),
    })
    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("brushSelected", { batch: [brush] })
    })
    flush()
    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()

    act(() => {
      chart.trigger("brushEnd", {
        brushId: brush.brushId,
        areas: brush.areas,
      })
    })
    flush()
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("handles toolbox clear without brushEnd and preserves native selection", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ id: "native", name: "Native" }],
    })
    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [4] }],
      })
    })
    flush()
    ;(widgetMgr.setStringValue as Mock).mockClear()

    const clearedBrushes = [
      createBrushSelection({
        brushId: "brush-0",
        brushIndex: 0,
        areas: [],
      }),
      createBrushSelection({
        brushId: "brush-1",
        brushIndex: 1,
        areas: [],
      }),
    ]
    act(() => {
      chart.trigger("brushSelected", { batch: clearedBrushes })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: "native",
          series_name: "Native",
          data_type: "main",
          data_indices: [4],
        },
      ],
      []
    )
    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "brushSelection",
      clearedBrushes
    )
  })

  it("preserves brush selection when the native selection is cleared", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    const area = {
      brushType: "rect",
      coordRange: [
        [0, 1],
        [2, 3],
      ],
    }
    const brush = createBrushSelection({
      areas: [area],
      selected: selectedWithMainHits([2]),
    })
    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [1] }],
      })
      triggerBrushGesture(chart, brush)
    })
    flush()
    ;(widgetMgr.setStringValue as Mock).mockClear()

    act(() => {
      chart.trigger("selectchanged", { selected: [] })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: null,
          series_name: null,
          data_type: "main",
          data_indices: [2],
        },
      ],
      [
        {
          brush_index: 0,
          brush_type: "rect",
          coord_range: area.coordRange,
        },
      ]
    )
  })

  it("keeps all brush components when one component emits brushEnd", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    const brush0 = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [{ brushType: "lineX", coordRange: [0, 2] }],
    })
    const brush1 = createBrushSelection({
      brushId: "brush-1",
      brushIndex: 1,
      areas: [{ brushType: "lineY", coordRange: [3, 5] }],
    })
    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("brushEnd", {
        brushId: brush1.brushId,
        areas: brush1.areas,
      })
    })
    flush()
    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()

    act(() => {
      chart.trigger("brushSelected", { batch: [brush0, brush1] })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [],
      [
        {
          brush_index: 0,
          brush_type: "lineX",
          coord_range: [0, 2],
        },
        {
          brush_index: 1,
          brush_type: "lineY",
          coord_range: [3, 5],
        },
      ]
    )
    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "brushSelection",
      [brush0, brush1]
    )
  })

  it("restores native points and targets each persisted brush component", () => {
    const selectedPoints = [
      { seriesIndex: 0, dataType: "node", dataIndex: [1, 3] },
    ]
    const brush0 = createBrushSelection({
      brushId: "brush-empty",
      brushIndex: 0,
      areas: [],
    })
    const brush1 = createBrushSelection({
      brushId: "brush-1",
      brushIndex: 1,
      areas: [{ brushType: "lineX", coordRange: [0, 2] }],
    })
    const brush3 = createBrushSelection({
      brushId: "brush-3",
      brushIndex: 3,
      areas: [{ brushType: "lineY", coordRange: [4, 6] }],
    })
    widgetMgr.getElementState.mockImplementation(
      (_id: string, key: string) => {
        if (key === "selectedPoints") {
          return selectedPoints
        }
        if (key === "brushSelection") {
          return [brush0, brush3, brush1]
        }
        return undefined
      }
    )
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()

    act(() => {
      result.current.restoreSelection(chart)
    })

    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "select",
      seriesIndex: 0,
      dataType: "node",
      dataIndex: [1, 3],
    })
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      brushIndex: 3,
      areas: brush3.areas,
    })
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      brushIndex: 1,
      areas: brush1.areas,
    })
    expect(chart.dispatchAction).not.toHaveBeenCalledWith({
      type: "brush",
      brushIndex: 0,
      areas: [],
    })
  })

  it("does not emit while restoreSelection dispatches native selection", () => {
    const selectedPoints = [{ seriesIndex: 0, dataIndex: [0] }]
    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "selectedPoints" ? selectedPoints : undefined
    )
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    chart.dispatchAction.mockImplementation(
      (payload: Record<string, unknown>) => {
        if (payload.type === "select") {
          chart.trigger("selectchanged", { selected: selectedPoints })
        }
      }
    )
    act(() => {
      result.current.bindSelections(chart)
      result.current.restoreSelection(chart)
    })
    flush()

    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("skips no-op widget-state writes", () => {
    const selected = [
      {
        series_index: 0,
        series_id: "sales",
        series_name: "Sales",
        data_type: "main",
        data_indices: [3],
      },
    ]
    widgetMgr.getStringValue.mockReturnValue(
      JSON.stringify({ selection: { selected, areas: [] } })
    )
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ id: "sales", name: "Sales" }],
    })
    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [3] }],
      })
    })
    flush()

    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("seeds native cache on remount so a new brush preserves it", () => {
    const persistedPoints = [{ seriesIndex: 0, dataIndex: [1] }]
    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "selectedPoints" ? persistedPoints : undefined
    )
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ id: "sales", name: "Sales" }],
    })
    const area = { brushType: "lineX", coordRange: [0, 2] }
    const brush = createBrushSelection({
      areas: [area],
      selected: selectedWithMainHits([2]),
    })
    act(() => {
      result.current.bindSelections(chart)
      triggerBrushGesture(chart, brush)
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: "sales",
          series_name: "Sales",
          data_type: "main",
          data_indices: [1, 2],
        },
      ],
      [
        {
          brush_index: 0,
          brush_type: "lineX",
          coord_range: [0, 2],
        },
      ]
    )
  })

  it("seeds brush cache on remount so a native event preserves it", () => {
    const area = {
      brushType: "rect",
      coordRange: [
        [0, 2],
        [10, 20],
      ],
    }
    const persistedBrush = createBrushSelection({
      areas: [area],
      selected: selectedWithMainHits([2]),
    })
    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "brushSelection" ? [persistedBrush] : undefined
    )
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ id: "sales", name: "Sales" }],
    })
    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [0] }],
      })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: "sales",
          series_name: "Sales",
          data_type: "main",
          data_indices: [0, 2],
        },
      ],
      [
        {
          brush_index: 0,
          brush_type: "rect",
          coord_range: area.coordRange,
        },
      ]
    )
  })

  it("clears visible and persisted selections on double-click", () => {
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
      chart.trigger("dblclick", {})
    })
    flush()

    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      areas: [],
    })
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "unselect",
      seriesIndex: 0,
      dataIndex: [2],
    })
    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "brushSelection",
      []
    )
    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "selectedPoints",
      []
    )
    expectSelectionWrite([], [])
  })

  it("does not clear a lasso completed by the same double-click", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    const polygon = {
      brushType: "polygon",
      coordRange: [
        [0, 0],
        [1, 1],
        [1, 0],
      ],
    }
    const brush = createBrushSelection({ areas: [polygon] })
    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("brushSelected", { batch: [brush] })
      chart.trigger("brushEnd", {
        brushId: brush.brushId,
        areas: brush.areas,
      })
      chart.trigger("dblclick", {})
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [],
      [
        {
          brush_index: 0,
          brush_type: "polygon",
          coord_range: polygon.coordRange,
        },
      ]
    )
    expect(chart.dispatchAction).not.toHaveBeenCalledWith({
      type: "brush",
      areas: [],
    })
  })

  it("does not clear when double-click is delivered before brushEnd", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    const polygon = {
      brushType: "polygon",
      coordRange: [
        [0, 0],
        [1, 1],
        [1, 0],
      ],
    }
    const brush = createBrushSelection({ areas: [polygon] })
    act(() => {
      result.current.bindSelections(chart)
      chart.trigger("brushSelected", { batch: [brush] })
      chart.trigger("dblclick", {})
      chart.trigger("brushEnd", {
        brushId: brush.brushId,
        areas: brush.areas,
      })
    })
    flush()

    expectSelectionWrite(
      [],
      [
        {
          brush_index: 0,
          brush_type: "polygon",
          coord_range: polygon.coordRange,
        },
      ]
    )
    expect(chart.dispatchAction).not.toHaveBeenCalledWith({
      type: "brush",
      areas: [],
    })
  })

  it("clears a finished lasso when it is double-clicked again", () => {
    const { result } = renderHook(() =>
      useEChartsSelections(createElement(), widgetMgr)
    )
    const chart = createFakeChart()
    const polygon = {
      brushType: "polygon",
      coordRange: [
        [0, 0],
        [1, 1],
        [1, 0],
      ],
    }
    const brush = createBrushSelection({ areas: [polygon] })
    act(() => {
      result.current.bindSelections(chart)
      triggerBrushGesture(chart, brush)
    })
    flush()
    ;(widgetMgr.setStringValue as Mock).mockClear()
    chart.dispatchAction.mockClear()

    // ECharts re-commits the same polygon when the active polygon tool receives
    // a second double-click. It must not be treated as a new polygon.
    act(() => {
      chart.trigger("brushEnd", {
        brushId: brush.brushId,
        areas: brush.areas,
      })
      chart.trigger("dblclick", {})
    })
    flush()

    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      areas: [],
    })
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite([], [])
  })

  it("clears selection state when its form is cleared", () => {
    widgetMgr.getStringValue.mockReturnValue(
      JSON.stringify({
        selection: {
          selected: [{ series_index: 0, data_indices: [1] }],
          areas: [],
        },
      })
    )
    const { result } = renderHook(() =>
      useEChartsSelections(createElement("chart-id", "form-id"), widgetMgr)
    )

    act(() => {
      result.current.onFormCleared()
    })

    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "brushSelection",
      []
    )
    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "selectedPoints",
      []
    )
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      "chart-id",
      JSON.stringify({ selection: { selected: [], areas: [] } }),
      { formId: "form-id", fragmentId: undefined, fromUser: true }
    )
  })
})
