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
import * as echarts from "echarts"
import type { Mock, Mocked } from "vitest"

import { EChartsChart as EChartsChartProto } from "@streamlit/protobuf"

import type { WidgetStateManager } from "~lib/WidgetStateManager"

import type { EChartsSelectionInstance } from "./selectionBinding"
import {
  useEChartsSelections,
  type UseEChartsSelectionsOptions,
  type UseEChartsSelectionsOutput,
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
  const handlers = new Map<string, Set<(params: unknown) => void>>()
  const on = (event: string, handler: (params: unknown) => void): void => {
    const eventHandlers = handlers.get(event) ?? new Set()
    eventHandlers.add(handler)
    handlers.set(event, eventHandlers)
  }
  const off = (event: string, handler?: (params: unknown) => void): void => {
    if (handler) {
      handlers.get(event)?.delete(handler)
    } else {
      handlers.delete(event)
    }
  }
  const chart = {
    on: vi.fn(on),
    off: vi.fn(off),
    zr: { on: vi.fn(on), off: vi.fn(off) },
    getZr: vi.fn(() => chart.zr),
    isDisposed: vi.fn(() => false),
    dispatchAction: vi.fn(),
    getOption: vi.fn(() => ({})),
    trigger: (event: string, params: unknown) => {
      for (const handler of handlers.get(event) ?? []) {
        handler(params)
      }
    },
  }
  return chart as unknown as Mocked<FakeChart>
}

function captureBrushAreas(
  chart: echarts.ECharts,
  areas: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  let captured: Array<Record<string, unknown>> | undefined
  const onBrushSelected = (event: unknown): void => {
    const batch = (
      event as {
        batch?: Array<{ areas?: Array<Record<string, unknown>> }>
      }
    ).batch
    const eventAreas = batch?.[0]?.areas
    if (!eventAreas || eventAreas.length === 0) {
      return
    }
    captured = eventAreas.map(area => {
      const geometry = { ...area }
      // Drop fields ECharts adds when storing the area. brushEnd carries the
      // geometry from setOutputRanges, not this enriched copy.
      delete geometry.brushMode
      delete geometry.transformable
      delete geometry.brushStyle
      delete geometry.removeOnClick
      delete geometry.z
      return geometry
    })
  }
  chart.on("brushSelected", onBrushSelected)
  chart.dispatchAction({ type: "brush", areas })
  chart.off("brushSelected", onBrushSelected)
  if (!captured) {
    throw new Error("brushSelected did not report areas")
  }
  return captured
}

function readBrushModel(chart: echarts.ECharts): {
  id: string
  option: { throttleType?: string; throttleDelay?: number }
} {
  const model = (
    chart as unknown as {
      getModel: () => {
        eachComponent: (
          query: { mainType: string },
          callback: (component: {
            id: string
            option: { throttleType?: string; throttleDelay?: number }
          }) => void
        ) => void
      }
    }
  ).getModel()
  let component:
    | {
        id: string
        option: { throttleType?: string; throttleDelay?: number }
      }
    | undefined
  model.eachComponent({ mainType: "brush" }, item => {
    component = item
  })
  if (!component) {
    throw new Error("missing brush component")
  }
  return component
}

function createElement(id = "chart-id", formId = ""): EChartsChartProto {
  return new EChartsChartProto({
    id,
    formId,
    selectionActivated: Boolean(id),
  })
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
      addFormSubmitValidator: vi.fn(),
      removeFormSubmitValidator: vi.fn(),
      addFormClearedListener: vi.fn(() => ({ disconnect: vi.fn() })),
    } as unknown as Mocked<WidgetStateManager>
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  /**
   * Render the hook the way EChartsChart does: without an instance first,
   * then ``bind(chart)`` passes the instance in and ``unbind()`` drops it.
   */
  const renderSelections = (
    element: EChartsChartProto = createElement(),
    options: Omit<
      UseEChartsSelectionsOptions,
      "element" | "widgetMgr" | "chart"
    > = {}
  ): {
    result: { current: UseEChartsSelectionsOutput }
    bind: (chart: EChartsSelectionInstance) => void
    unbind: () => void
  } => {
    const { result, rerender } = renderHook<
      UseEChartsSelectionsOutput,
      { chart: EChartsSelectionInstance | null }
    >(
      ({ chart }) =>
        useEChartsSelections({ element, widgetMgr, chart, ...options }),
      { initialProps: { chart: null } }
    )
    return {
      result,
      bind: chart => rerender({ chart }),
      unbind: () => rerender({ chart: null }),
    }
  }

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
    const display = renderSelections(createElement(""))
    const displayChart = createFakeChart()

    display.bind(displayChart)
    expect(displayChart.on).not.toHaveBeenCalled()
    act(() => {
      display.unbind()
    })
    expect(displayChart.off).not.toHaveBeenCalled()

    const disabled = renderSelections(createElement(), { disabled: true })
    const disabledChart = createFakeChart()
    disabled.bind(disabledChart)
    expect(disabledChart.on).not.toHaveBeenCalled()
    act(() => {
      disabled.unbind()
    })
    expect(disabledChart.off).not.toHaveBeenCalled()
  })

  it("does not treat a keyed display-only chart as a selection widget", () => {
    const { result, bind } = renderSelections(
      new EChartsChartProto({
        id: "styled_chart",
        formId: "",
        selectionActivated: false,
      })
    )
    const chart = createFakeChart()
    bind(chart)
    expect(chart.on).not.toHaveBeenCalled()
    expect(
      result.current.applyDisplayOnlyCursorDefault({
        series: [{ type: "bar" }],
      })
    ).toEqual({
      series: [{ type: "bar", cursor: "default" }],
    })
  })

  it("does not restore leftover selection on a keyed display-only chart", () => {
    widgetMgr.getElementState.mockImplementation(
      (_id: string, key: string) => {
        if (key === "selectedPoints") {
          return [{ seriesIndex: 0, dataIndex: [0] }]
        }
        if (key === "brushSelection") {
          return [
            createBrushSelection({
              areas: [
                {
                  brushType: "rect",
                  coordRange: [
                    [0, 1],
                    [0, 1],
                  ],
                },
              ],
            }),
          ]
        }
        return undefined
      }
    )
    const { result, bind } = renderSelections(
      new EChartsChartProto({
        id: "styled_chart",
        formId: "",
        selectionActivated: false,
      })
    )
    const chart = createFakeChart()
    bind(chart)
    act(() => {
      result.current.restoreSelection()
    })
    expect(widgetMgr.getElementState).not.toHaveBeenCalled()
    expect(chart.dispatchAction).not.toHaveBeenCalled()
  })

  it("restores persisted selection on a disabled selection widget", () => {
    widgetMgr.getElementState.mockImplementation(
      (_id: string, key: string) => {
        if (key === "selectedPoints") {
          return [{ seriesIndex: 0, dataIndex: [0] }]
        }
        if (key === "brushSelection") {
          return [
            createBrushSelection({
              areas: [{ brushType: "lineX", coordRange: [0, 2] }],
            }),
          ]
        }
        return undefined
      }
    )
    const { result, bind } = renderSelections(createElement(), {
      disabled: true,
    })
    const chart = createFakeChart()

    bind(chart)
    // Binding restores, and so does each later restore call.
    expect(chart.dispatchAction).toHaveBeenCalledTimes(2)
    act(() => {
      result.current.restoreSelection()
    })
    expect(chart.dispatchAction).toHaveBeenCalledTimes(4)
    expect(chart.on).not.toHaveBeenCalled()
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "select",
      seriesIndex: 0,
      dataIndex: [0],
    })
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      brushIndex: 0,
      areas: [{ brushType: "lineX", coordRange: [0, 2] }],
    })
  })

  it("binds and cleans up all selection listeners", () => {
    const { bind, unbind } = renderSelections()
    const chart = createFakeChart()

    bind(chart)
    for (const event of ["selectchanged", "brushSelected", "brushEnd"]) {
      expect(chart.on).toHaveBeenCalledWith(event, expect.any(Function))
    }
    expect(chart.on).not.toHaveBeenCalledWith("dblclick", expect.any(Function))
    expect(chart.zr.on).toHaveBeenCalledWith("dblclick", expect.any(Function))

    act(() => {
      unbind()
    })

    expect(chart.off).toHaveBeenCalledTimes(3)
    expect(chart.zr.off).toHaveBeenCalledWith("dblclick", expect.any(Function))
  })

  it("skips listener cleanup after the chart is disposed", () => {
    const { bind, unbind } = renderSelections()
    const chart = createFakeChart()
    bind(chart)

    chart.isDisposed.mockReturnValue(true)
    act(() => {
      unbind()
    })

    expect(chart.off).not.toHaveBeenCalled()
    expect(chart.zr.off).not.toHaveBeenCalled()
  })

  it("keeps the binding across spec changes and still writes a pending selection", () => {
    const firstSpec = JSON.stringify({
      series: [{ type: "bar", data: [1] }],
    })
    const secondSpec = JSON.stringify({
      series: [{ type: "bar", data: [9] }],
    })
    const chart = createFakeChart()
    const { result, rerender } = renderHook(
      ({ spec }) =>
        useEChartsSelections({
          element: new EChartsChartProto({
            id: "chart-id",
            formId: "",
            spec,
            selectionActivated: true,
          }),
          widgetMgr,
          chart,
        }),
      { initialProps: { spec: firstSpec } }
    )
    const { restoreSelection, pruneAfterResize } = result.current

    act(() => {
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [0] }],
      })
    })

    rerender({ spec: secondSpec })

    expect(result.current.restoreSelection).toBe(restoreSelection)
    expect(result.current.pruneAfterResize).toBe(pruneAfterResize)
    // A rebind would have unbound the handlers and flushed the write early.
    expect(chart.off).not.toHaveBeenCalled()
    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()

    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: null,
          series_name: null,
          data_type: "main",
          data_indices: [0],
        },
      ],
      []
    )
  })

  it("flushes a pending selection write on bindSelections cleanup", () => {
    const { bind, unbind } = renderSelections()
    const chart = createFakeChart()
    bind(chart)
    act(() => {
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [0] }],
      })
    })

    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()

    act(() => {
      unbind()
    })

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: null,
          series_name: null,
          data_type: "main",
          data_indices: [0],
        },
      ],
      []
    )
  })

  it("flushes a pending selection write on cleanup even if the chart is disposed", () => {
    const { bind, unbind } = renderSelections()
    const chart = createFakeChart()
    bind(chart)
    act(() => {
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [0] }],
      })
    })

    chart.isDisposed.mockReturnValue(true)
    act(() => {
      unbind()
    })

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: null,
          series_name: null,
          data_type: "main",
          data_indices: [0],
        },
      ],
      []
    )
    expect(chart.off).not.toHaveBeenCalled()
  })

  it("leaves a selection widget option untouched", () => {
    const { result } = renderSelections()
    const option = { series: [{ type: "bar", data: [1, 2, 3] }] }

    const configured = result.current.applyDisplayOnlyCursorDefault(option)

    expect(configured).toBe(option)
    expect(configured.brush).toBeUndefined()
    expect(configured.toolbox).toBeUndefined()
    const series = configured.series as Array<Record<string, unknown>>
    expect(series[0].selectedMode).toBeUndefined()
    expect(series[0].select).toBeUndefined()
  })

  it("does not rewrite a disabled selection widget's option", () => {
    const { result } = renderSelections(createElement(), { disabled: true })
    const option = { series: [{ type: "bar", data: [1, 2, 3] }] }

    const configured = result.current.applyDisplayOnlyCursorDefault(option)

    expect(configured).toBe(option)
    const series = configured.series as Array<Record<string, unknown>>
    expect(series[0].cursor).toBeUndefined()
  })

  it("uses a default cursor only for display-only series without one", () => {
    const { result } = renderSelections(createElement(""))

    const configured = result.current.applyDisplayOnlyCursorDefault({
      series: [
        { type: "bar", data: [1] },
        { type: "line", data: [2], cursor: "crosshair" },
      ],
    })
    const series = configured.series as Array<Record<string, unknown>>
    expect(series[0].cursor).toBe("default")
    expect(series[1].cursor).toBe("crosshair")

    const single = result.current.applyDisplayOnlyCursorDefault({
      series: { type: "pie", data: [] },
    })
    expect((single.series as Record<string, unknown>).cursor).toBe("default")

    const noSeries = {}
    expect(result.current.applyDisplayOnlyCursorDefault(noSeries)).toBe(
      noSeries
    )
  })

  it("applies the default cursor inside timeline baseOption and options", () => {
    const { result } = renderSelections(createElement(""))

    const configured = result.current.applyDisplayOnlyCursorDefault({
      baseOption: { series: [{ type: "bar", data: [1] }] },
      options: [{ series: [{ type: "line", data: [2] }] }],
    })

    expect(
      (
        (configured.baseOption as Record<string, unknown>).series as Array<
          Record<string, unknown>
        >
      )[0].cursor
    ).toBe("default")
    expect(
      (
        (configured.options as Array<Record<string, unknown>>)[0]
          .series as Array<Record<string, unknown>>
      )[0].cursor
    ).toBe("default")
  })

  it("reports explicit series metadata and sanitizes invalid metadata", () => {
    const { bind } = renderSelections()
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [
        { id: "sales-id", name: "Sales" },
        { id: 42, name: 7 },
        { id: "bad\0id", name: "bad\0name" },
        { id: "", name: null },
      ],
    })
    bind(chart)
    act(() => {
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

  it.each([
    [
      "timeline",
      {
        baseOption: { timeline: { data: ["2015"] } },
        options: [{ series: [{ type: "bar" }] }],
      },
    ],
    [
      "media",
      {
        media: [
          {
            query: { maxWidth: 600 },
            option: { series: [{ type: "bar" }] },
          },
        ],
      },
    ],
    ["empty series array", { series: [] }],
  ])(
    "resolves series metadata from getOption for a %s spec",
    (_name, spec) => {
      const { bind } = renderSelections(
        new EChartsChartProto({
          id: "chart-id",
          formId: "",
          spec: JSON.stringify(spec),
          selectionActivated: true,
        })
      )
      const chart = createFakeChart()
      chart.getOption.mockReturnValue({
        series: [{ id: "sales", name: "Sales" }],
      })
      bind(chart)
      act(() => {
        chart.trigger("selectchanged", {
          selected: [{ seriesIndex: 0, dataIndex: [4] }],
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
            data_indices: [4],
          },
        ],
        []
      )
    }
  )

  it("resolves series metadata from getOption when media overrides top-level series", () => {
    const { bind } = renderSelections(
      new EChartsChartProto({
        id: "chart-id",
        formId: "",
        spec: JSON.stringify({
          series: [{ type: "bar", id: "desktop", name: "Desktop" }],
          media: [
            {
              query: { maxWidth: 600 },
              option: {
                series: [{ type: "bar", id: "mobile", name: "Mobile" }],
              },
            },
          ],
        }),
        selectionActivated: true,
      })
    )
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ id: "mobile", name: "Mobile" }],
    })
    bind(chart)
    act(() => {
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [4] }],
      })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: "mobile",
          series_name: "Mobile",
          data_type: "main",
          data_indices: [4],
        },
      ],
      []
    )
  })

  it("groups selections deterministically and sorts and deduplicates indices", () => {
    const { bind } = renderSelections()
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [
        { id: "graph", name: "Graph" },
        { id: "other", name: "Other" },
      ],
    })
    bind(chart)
    act(() => {
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

  it.each(["graph", "sankey"] as const)(
    "tracks %s node and edge actions as independent data types",
    seriesType => {
      const { bind } = renderSelections()
      const chart = createFakeChart()
      chart.getOption.mockReturnValue({
        series: [
          {
            id: "network",
            name: "Network",
            type: seriesType,
            selectedMode: "multiple",
            data: [{ id: "a" }, { id: "b" }],
            links: [{ source: "a", target: "b" }],
          },
        ],
      })
      bind(chart)
      act(() => {
        chart.trigger("selectchanged", {
          fromAction: "select",
          fromActionPayload: {
            seriesIndex: 0,
            dataType: "node",
            dataIndexInside: 0,
          },
          // ECharts repeats its shared internal selection map for both types.
          selected: [
            { seriesIndex: 0, dataType: "node", dataIndex: [0] },
            { seriesIndex: 0, dataType: "edge", dataIndex: [0] },
          ],
        })
      })
      flush()

      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
      expectSelectionWrite(
        [
          {
            series_index: 0,
            series_id: "network",
            series_name: "Network",
            data_type: "node",
            data_indices: [0],
          },
        ],
        []
      )

      ;(widgetMgr.setStringValue as Mock).mockClear()
      act(() => {
        chart.trigger("selectchanged", {
          fromAction: "select",
          fromActionPayload: {
            seriesIndex: 0,
            dataType: "edge",
            dataIndexInside: 1,
          },
          selected: [
            { seriesIndex: 0, dataType: "node", dataIndex: [0, 1] },
            { seriesIndex: 0, dataType: "edge", dataIndex: [0, 1] },
          ],
        })
      })
      flush()

      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
      expectSelectionWrite(
        [
          {
            series_index: 0,
            series_id: "network",
            series_name: "Network",
            data_type: "node",
            data_indices: [0],
          },
          {
            series_index: 0,
            series_id: "network",
            series_name: "Network",
            data_type: "edge",
            data_indices: [1],
          },
        ],
        []
      )

      ;(widgetMgr.setStringValue as Mock).mockClear()
      act(() => {
        chart.trigger("selectchanged", {
          fromAction: "unselect",
          fromActionPayload: {
            seriesIndex: 0,
            dataType: "node",
            dataIndexInside: 0,
          },
          selected: [
            { seriesIndex: 0, dataType: "node", dataIndex: [1] },
            { seriesIndex: 0, dataType: "edge", dataIndex: [1] },
          ],
        })
      })
      flush()

      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
      expectSelectionWrite(
        [
          {
            series_index: 0,
            series_id: "network",
            series_name: "Network",
            data_type: "edge",
            data_indices: [1],
          },
        ],
        []
      )
    }
  )

  it.each(["graph", "sankey"] as const)(
    "replaces the previous %s data type in single-selection mode",
    seriesType => {
      const { bind } = renderSelections()
      const chart = createFakeChart()
      chart.getOption.mockReturnValue({
        series: [
          {
            type: seriesType,
            selectedMode: "single",
            data: [{ id: "a" }],
            links: [{ source: "a", target: "a" }],
          },
        ],
      })
      bind(chart)
      act(() => {
        chart.trigger("selectchanged", {
          fromAction: "select",
          fromActionPayload: {
            seriesIndex: 0,
            dataType: "node",
            dataIndexInside: 0,
          },
          selected: [
            { seriesIndex: 0, dataType: "node", dataIndex: [0] },
            { seriesIndex: 0, dataType: "edge", dataIndex: [0] },
          ],
        })
      })
      flush()
      ;(widgetMgr.setStringValue as Mock).mockClear()

      act(() => {
        chart.trigger("selectchanged", {
          fromAction: "select",
          fromActionPayload: {
            seriesIndex: 0,
            dataType: "edge",
            dataIndexInside: 0,
          },
          selected: [
            { seriesIndex: 0, dataType: "node", dataIndex: [0] },
            { seriesIndex: 0, dataType: "edge", dataIndex: [0] },
          ],
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
            data_type: "edge",
            data_indices: [0],
          },
        ],
        []
      )
    }
  )

  it("uses graph node and edge lengths for whole-series selection", () => {
    const { bind } = renderSelections()
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [
        {
          type: "graph",
          selectedMode: "series",
          data: [{ id: "a" }, { id: "b" }, { id: "c" }],
          links: [
            { source: "a", target: "b" },
            { source: "b", target: "c" },
          ],
        },
      ],
    })
    bind(chart)
    act(() => {
      chart.trigger("selectchanged", {
        fromAction: "select",
        fromActionPayload: {
          seriesIndex: 0,
          dataType: "node",
          dataIndexInside: 0,
        },
        selected: [
          { seriesIndex: 0, dataType: "node", dataIndex: [0, 1, 2] },
          { seriesIndex: 0, dataType: "edge", dataIndex: [0, 1, 2] },
        ],
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
          data_type: "node",
          data_indices: [0, 1, 2],
        },
        {
          series_index: 0,
          series_id: null,
          series_name: null,
          data_type: "edge",
          data_indices: [0, 1],
        },
      ],
      []
    )
  })

  it("toggles a graph series selection off on a second click", () => {
    const { bind } = renderSelections()
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [
        {
          type: "graph",
          selectedMode: "series",
          data: [{ id: "a" }, { id: "b" }],
          links: [{ source: "a", target: "b" }],
        },
      ],
    })
    const toggleEvent = {
      fromAction: "toggleSelect",
      fromActionPayload: {
        seriesIndex: 0,
        dataType: "node",
        dataIndexInside: 0,
      },
      selected: [
        { seriesIndex: 0, dataType: "node", dataIndex: [0, 1] },
        { seriesIndex: 0, dataType: "edge", dataIndex: [0] },
      ],
    }
    bind(chart)
    act(() => {
      chart.trigger("selectchanged", toggleEvent)
    })
    flush()
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite(
      [
        {
          series_index: 0,
          series_id: null,
          series_name: null,
          data_type: "node",
          data_indices: [0, 1],
        },
        {
          series_index: 0,
          series_id: null,
          series_name: null,
          data_type: "edge",
          data_indices: [0],
        },
      ],
      []
    )

    widgetMgr.getStringValue.mockReturnValue(
      JSON.stringify({
        selection: {
          selected: [
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "node",
              data_indices: [0, 1],
            },
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "edge",
              data_indices: [0],
            },
          ],
          areas: [],
        },
      })
    )
    ;(widgetMgr.setStringValue as Mock).mockClear()
    act(() => {
      chart.trigger("selectchanged", toggleEvent)
    })
    flush()
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expectSelectionWrite([], [])
  })

  it("keeps graph node and edge groups when another series is selected", () => {
    const chart = echarts.init(null, null, {
      renderer: "svg",
      ssr: true,
      width: 600,
      height: 400,
    })
    try {
      chart.setOption({
        animation: false,
        xAxis: { type: "category", data: ["x", "y", "z"] },
        yAxis: { type: "value" },
        series: [
          {
            id: "network",
            type: "graph",
            layout: "none",
            selectedMode: "multiple",
            data: [
              { name: "a", x: 0, y: 0 },
              { name: "b", x: 10, y: 10 },
            ],
            links: [{ source: "a", target: "b" }],
          },
          {
            id: "sales",
            type: "bar",
            selectedMode: "multiple",
            data: [1, 2, 3],
          },
        ],
      })
      const { bind } = renderSelections()
      const networkGroups = [
        {
          series_index: 0,
          series_id: "network",
          series_name: null,
          data_type: "node",
          data_indices: [1],
        },
        {
          series_index: 0,
          series_id: "network",
          series_name: null,
          data_type: "edge",
          data_indices: [0],
        },
      ]

      bind(chart)
      act(() => {
        chart.dispatchAction({
          type: "select",
          seriesIndex: 0,
          dataType: "node",
          dataIndex: 1,
        })
        chart.dispatchAction({
          type: "select",
          seriesIndex: 0,
          dataType: "edge",
          dataIndex: 0,
        })
      })
      flush()
      expectSelectionWrite(networkGroups, [])

      act(() => {
        chart.dispatchAction({ type: "select", seriesIndex: 1, dataIndex: 2 })
      })
      flush()

      // ECharts' snapshot for the bar click repeats the graph's shared
      // selection map (node 1 and edge 0) under both data types.
      expectSelectionWrite(
        [
          ...networkGroups,
          {
            series_index: 1,
            series_id: "sales",
            series_name: null,
            data_type: "main",
            data_indices: [2],
          },
        ],
        [],
        2
      )
      expect(widgetMgr.setElementState).toHaveBeenLastCalledWith(
        "chart-id",
        "selectedPoints",
        [
          { seriesIndex: 0, dataType: "node", dataIndex: [1] },
          { seriesIndex: 0, dataType: "edge", dataIndex: [0] },
          { seriesIndex: 1, dataIndex: [2] },
        ]
      )
    } finally {
      chart.dispose()
    }
  })

  it("persists native points without clearing the brush cache", () => {
    const { bind } = renderSelections()
    const chart = createFakeChart()
    const selected = [{ seriesIndex: 0, dataIndex: [2] }]
    bind(chart)
    act(() => {
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
    const { bind } = renderSelections()
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

    bind(chart)
    act(() => {
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
    const { bind } = renderSelections()
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

    bind(chart)
    act(() => {
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
        // The pixel-only area of brush 2 is deliberately absent: without a
        // coordRange there is nothing an app could map back to its data.
      ]
    )
  })

  it("keeps a pixel-only brush area out of the public payload but still restores it", () => {
    const { result, bind } = renderSelections()
    const chart = createFakeChart()
    const pixelOnly = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [
        {
          brushType: "rect",
          range: [
            [10, 20],
            [30, 40],
          ],
        },
      ],
    })

    bind(chart)
    act(() => {
      chart.trigger("brushSelected", { batch: [pixelOnly] })
      chart.trigger("brushEnd", {
        brushId: pixelOnly.brushId,
        areas: pixelOnly.areas,
      })
    })
    flush()

    // The public payload stays empty, so there is no rerun for a region the
    // app could not interpret anyway.
    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
    // The geometry is still persisted privately, so the on-screen overlay
    // survives a rerun even though the app never sees the area.
    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "brushSelection",
      [pixelOnly]
    )

    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "brushSelection" ? [pixelOnly] : undefined
    )
    chart.dispatchAction.mockClear()
    act(() => {
      result.current.restoreSelection()
    })
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      brushIndex: 0,
      areas: pixelOnly.areas,
    })
  })

  it("does not emit an in-progress brush when a point selection writes", () => {
    const { bind } = renderSelections()
    const chart = createFakeChart()
    const committedArea = {
      brushType: "lineX" as const,
      coordRange: [0, 2],
    }
    const inProgressArea = {
      brushType: "lineX" as const,
      coordRange: [4, 8],
    }
    const committedBrush = createBrushSelection({
      brushId: "brush-0",
      areas: [committedArea],
    })
    const inProgressBrush = createBrushSelection({
      brushId: "brush-0",
      areas: [inProgressArea],
    })

    bind(chart)
    act(() => {
      chart.trigger("brushSelected", { batch: [committedBrush] })
      chart.trigger("brushEnd", {
        brushId: committedBrush.brushId,
        areas: committedBrush.areas,
      })
    })
    flush()
    ;(widgetMgr.setStringValue as Mock).mockClear()

    act(() => {
      chart.trigger("brushSelected", { batch: [inProgressBrush] })
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [1] }],
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
          brush_type: "lineX",
          coord_range: committedArea.coordRange,
        },
      ]
    )
  })

  it("drops pixel-only brush areas from private state after resize", () => {
    const pixelOnly = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [
        {
          brushType: "rect",
          range: [
            [10, 20],
            [30, 40],
          ],
        },
      ],
    })
    const withCoord = createBrushSelection({
      brushId: "brush-1",
      brushIndex: 1,
      areas: [{ brushType: "lineX", coordRange: [1, 3] }],
    })
    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "brushSelection" ? [pixelOnly, withCoord] : undefined
    )
    const { result, bind } = renderSelections()
    const chart = createFakeChart()

    bind(chart)
    act(() => {
      result.current.pruneAfterResize()
    })

    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "brushSelection",
      [{ ...pixelOnly, areas: [], selected: [] }, withCoord]
    )
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      brushIndex: 0,
      areas: [],
    })
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      brushIndex: 1,
      areas: withCoord.areas,
    })
  })

  it("still prunes pixel-only brush areas while the widget is disabled", () => {
    const pixelOnly = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [
        {
          brushType: "rect",
          range: [
            [10, 20],
            [30, 40],
          ],
        },
      ],
    })
    const withCoord = createBrushSelection({
      brushId: "brush-1",
      brushIndex: 1,
      areas: [{ brushType: "lineX", coordRange: [1, 3] }],
    })
    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "brushSelection" ? [pixelOnly, withCoord] : undefined
    )
    const { result, bind } = renderSelections(createElement(), {
      disabled: true,
    })
    const chart = createFakeChart()

    bind(chart)
    act(() => {
      result.current.pruneAfterResize()
    })
    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      "chart-id",
      "brushSelection",
      [{ ...pixelOnly, areas: [], selected: [] }, withCoord]
    )
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      brushIndex: 0,
      areas: [],
    })
  })

  it("prunes mixed brushes after bind without a user-gesture rerun", () => {
    const pixelOnly = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [
        {
          brushType: "rect",
          range: [
            [10, 20],
            [30, 40],
          ],
        },
      ],
      selected: selectedWithMainHits([9]),
    })
    const withCoord = createBrushSelection({
      brushId: "brush-1",
      brushIndex: 1,
      areas: [{ brushType: "lineX", coordRange: [1, 3] }],
      selected: selectedWithMainHits([1]),
    })
    widgetMgr.getElementState.mockImplementation(
      (_id: string, key: string) => {
        if (key === "brushSelection") {
          return [pixelOnly, withCoord]
        }
        if (key === "selectedPoints") {
          return []
        }
        return undefined
      }
    )
    const { result, bind } = renderSelections()
    const chart = createFakeChart()

    bind(chart)
    act(() => {
      result.current.pruneAfterResize()
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      "chart-id",
      JSON.stringify({
        selection: {
          selected: [
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "main",
              data_indices: [1],
            },
          ],
          areas: [
            {
              brush_index: 1,
              brush_type: "lineX",
              coord_range: [1, 3],
            },
          ],
        },
      }),
      { formId: "", fragmentId: undefined, fromUser: false }
    )
  })

  it("reruns the first user brush after a prune and rebind", () => {
    const pixelOnly = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [
        {
          brushType: "rect",
          range: [
            [10, 20],
            [30, 40],
          ],
        },
      ],
    })
    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "brushSelection" ? [pixelOnly] : undefined
    )
    const { result, bind, unbind } = renderSelections()
    const chart = createFakeChart()

    bind(chart)
    act(() => {
      result.current.pruneAfterResize()
    })
    ;(widgetMgr.setStringValue as Mock).mockClear()
    widgetMgr.getElementState.mockReturnValue(undefined)

    const area = { brushType: "lineX", coordRange: [0, 2] }
    const brush = createBrushSelection({ areas: [area] })
    unbind()
    expect(chart.off).toHaveBeenCalledWith("brushEnd", expect.any(Function))
    bind(chart)
    act(() => {
      triggerBrushGesture(chart, brush)
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      "chart-id",
      JSON.stringify({
        selection: {
          selected: [],
          areas: [
            {
              brush_index: 0,
              brush_type: "lineX",
              coord_range: area.coordRange,
            },
          ],
        },
      }),
      { formId: "", fragmentId: undefined, fromUser: true }
    )
  })

  it("rebuilds same-component selected hits after pruning a pixel-only area", () => {
    const mixed = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [
        {
          brushType: "rect",
          range: [
            [10, 20],
            [30, 40],
          ],
        },
        { brushType: "lineX", coordRange: [1, 3] },
      ],
      selected: selectedWithMainHits([9, 1]),
    })
    const remaining = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [{ brushType: "lineX", coordRange: [1, 3] }],
      selected: selectedWithMainHits([1]),
    })
    widgetMgr.getElementState.mockImplementation(
      (_id: string, key: string) => {
        if (key === "brushSelection") {
          return [mixed]
        }
        if (key === "selectedPoints") {
          return []
        }
        return undefined
      }
    )
    const { result, bind } = renderSelections()
    const chart = createFakeChart()
    chart.dispatchAction.mockImplementation(
      (action: Record<string, unknown>) => {
        if (action.type === "brush") {
          chart.trigger("brushSelected", { batch: [remaining] })
        }
      }
    )

    bind(chart)
    act(() => {
      result.current.pruneAfterResize()
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      "chart-id",
      JSON.stringify({
        selection: {
          selected: [
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "main",
              data_indices: [1],
            },
          ],
          areas: [
            {
              brush_index: 0,
              brush_type: "lineX",
              coord_range: [1, 3],
            },
          ],
        },
      }),
      { formId: "", fragmentId: undefined, fromUser: false }
    )
  })

  it.each([
    ["enabled", false],
    // No handlers are bound, but prune still has to see the fresh hit-test.
    ["disabled", true],
  ])(
    "hit-tests pruned brush areas on the resize turn despite the user's throttle (%s)",
    (_name, disabled) => {
      const chart = echarts.init(null, null, {
        renderer: "svg",
        ssr: true,
        width: 600,
        height: 400,
      })
      try {
        chart.setOption({
          animation: false,
          xAxis: { type: "value", min: 0, max: 10 },
          yAxis: { type: "value", min: 0, max: 10 },
          brush: { xAxisIndex: "all", yAxisIndex: "all" },
          series: {
            type: "scatter",
            data: [
              [1, 1],
              [2, 2],
              [8, 8],
            ],
          },
        })
        const coordArea = {
          brushType: "rect",
          coordRange: [
            [0, 3],
            [0, 3],
          ],
          xAxisIndex: 0,
          yAxisIndex: 0,
        }
        // A global pixel-space rect around [8, 8] that no longer maps to the
        // chart once it resizes.
        const [left, top] = chart.convertToPixel({ gridIndex: 0 }, [7, 9])
        const [right, bottom] = chart.convertToPixel({ gridIndex: 0 }, [9, 7])
        const pixelOnlyArea = {
          brushType: "rect",
          range: [
            [left, right],
            [top, bottom],
          ],
        }
        const mixed = createBrushSelection({
          areas: [coordArea, pixelOnlyArea],
          selected: [{ seriesIndex: 0, dataIndex: [0, 1, 2] }],
        })
        widgetMgr.getElementState.mockImplementation(
          (_id: string, key: string) =>
            key === "brushSelection" ? [mixed] : undefined
        )
        const brushModel = readBrushModel(chart)
        brushModel.option.throttleType = "debounce"
        brushModel.option.throttleDelay = 10_000

        const { result, bind } = renderSelections(createElement(), {
          disabled: disabled,
        })

        bind(chart)
        act(() => {
          result.current.pruneAfterResize()
        })

        // One write on the resize turn, already carrying the hit-test of the
        // remaining coord area, without a user rerun.
        expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
        const [, json, options] = (widgetMgr.setStringValue as Mock).mock
          .calls[0] as [string, string, unknown]
        const { selection } = JSON.parse(json) as {
          selection: {
            selected: Array<{ data_indices: number[] }>
            areas: Array<{ brush_type: string }>
          }
        }
        expect(selection.selected.map(group => group.data_indices)).toEqual([
          [0, 1],
        ])
        expect(selection.areas).toEqual([
          expect.objectContaining({ brush_index: 0, brush_type: "rect" }),
        ])
        expect(options).toEqual({
          formId: "",
          fragmentId: undefined,
          fromUser: false,
        })
        expect(brushModel.option).toMatchObject({
          throttleType: "debounce",
          throttleDelay: 10_000,
        })

        // The user's throttle had nothing left to deliver.
        act(() => {
          vi.advanceTimersByTime(10_000 + DEBOUNCE_TIME_MS)
        })
        expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
      } finally {
        chart.dispose()
      }
    }
  )

  it("restores without emitting while handlers stay bound across setOption", () => {
    const chart = echarts.init(null, null, {
      renderer: "svg",
      ssr: true,
      width: 600,
      height: 400,
    })
    try {
      const option = {
        animation: false,
        xAxis: { type: "value", min: 0, max: 10 },
        yAxis: { type: "value", min: 0, max: 10 },
        brush: { xAxisIndex: "all", yAxisIndex: "all" },
        series: {
          type: "scatter",
          selectedMode: "multiple",
          data: [
            [1, 1],
            [2, 2],
            [8, 8],
          ],
        },
      }
      chart.setOption(option)
      const brush = createBrushSelection({
        areas: [
          {
            brushType: "rect",
            coordRange: [
              [0, 3],
              [0, 3],
            ],
            xAxisIndex: 0,
            yAxisIndex: 0,
          },
        ],
        selected: [{ seriesIndex: 0, dataIndex: [0, 1] }],
      })
      widgetMgr.getElementState.mockImplementation(
        (_id: string, key: string) => {
          if (key === "brushSelection") {
            return [brush]
          }
          if (key === "selectedPoints") {
            return [{ seriesIndex: 0, dataIndex: [2] }]
          }
          return undefined
        }
      )
      const selectChanged = vi.fn()
      const brushSelected = vi.fn()
      chart.on("selectchanged", selectChanged)
      chart.on("brushSelected", brushSelected)
      const { result, bind } = renderSelections()

      // Binding restores while its handlers are already attached; a data-only
      // rerun then replaces the option and restores again.
      bind(chart)
      act(() => {
        chart.setOption(option, { notMerge: true })
        result.current.restoreSelection()
      })
      flush()

      // Restore really fired ECharts' selection events...
      expect(selectChanged).toHaveBeenCalled()
      expect(brushSelected).toHaveBeenCalled()
      // ...and none of them reached widget or element state.
      expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
      expect(widgetMgr.setElementState).not.toHaveBeenCalled()
    } finally {
      chart.dispose()
    }
  })

  it("reruns a user brushEnd that matches a programmatic prune write", () => {
    const mixed = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [
        {
          brushType: "rect",
          range: [
            [10, 20],
            [30, 40],
          ],
        },
        { brushType: "lineX", coordRange: [1, 3] },
      ],
      selected: selectedWithMainHits([9, 1]),
    })
    const remaining = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [{ brushType: "lineX", coordRange: [1, 3] }],
      selected: selectedWithMainHits([1]),
    })
    widgetMgr.setStringValue.mockImplementation(
      (_id: string, value: string | null) => {
        widgetMgr.getStringValue.mockReturnValue(value ?? undefined)
      }
    )
    widgetMgr.getElementState.mockImplementation(
      (_id: string, key: string) => {
        if (key === "brushSelection") {
          return [mixed]
        }
        if (key === "selectedPoints") {
          return []
        }
        return undefined
      }
    )
    const { result, bind } = renderSelections()
    const chart = createFakeChart()
    // Prune hit-tests synchronously, so its snapshot arrives inside the
    // dispatch.
    chart.dispatchAction.mockImplementation(
      (action: Record<string, unknown>) => {
        if (action.type === "brush") {
          chart.trigger("brushSelected", { batch: [remaining] })
        }
      }
    )

    bind(chart)
    act(() => {
      result.current.pruneAfterResize()
    })
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      "chart-id",
      expect.any(String),
      { formId: "", fragmentId: undefined, fromUser: false }
    )
    ;(widgetMgr.setStringValue as Mock).mockClear()

    act(() => {
      chart.trigger("brushEnd", {
        brushId: remaining.brushId,
        areas: remaining.areas,
      })
    })
    flush()

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      "chart-id",
      JSON.stringify({
        selection: {
          selected: [
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "main",
              data_indices: [1],
            },
          ],
          areas: [
            {
              brush_index: 0,
              brush_type: "lineX",
              coord_range: [1, 3],
            },
          ],
        },
      }),
      { formId: "", fragmentId: undefined, fromUser: true }
    )
  })

  it("routes a form prune write through the pending form dict", () => {
    const mixed = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [
        {
          brushType: "rect",
          range: [
            [10, 20],
            [30, 40],
          ],
        },
        { brushType: "lineX", coordRange: [1, 3] },
      ],
      selected: selectedWithMainHits([1]),
    })
    widgetMgr.getElementState.mockImplementation(
      (_id: string, key: string) => {
        if (key === "brushSelection") {
          return [mixed]
        }
        if (key === "selectedPoints") {
          return []
        }
        return undefined
      }
    )
    const { result, bind } = renderSelections(
      createElement("chart-id", "form-id")
    )
    const chart = createFakeChart()

    bind(chart)
    act(() => {
      result.current.pruneAfterResize()
    })

    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      "chart-id",
      JSON.stringify({
        selection: {
          selected: [
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "main",
              data_indices: [1],
            },
          ],
          areas: [
            {
              brush_index: 0,
              brush_type: "lineX",
              coord_range: [1, 3],
            },
          ],
        },
      }),
      { formId: "form-id", fragmentId: undefined, fromUser: true }
    )
  })

  it.each([
    ["brushSelected first", ["brushSelected", "brushEnd"] as const],
    ["brushEnd first", ["brushEnd", "brushSelected"] as const],
  ])(
    "commits one update in either ECharts event order (%s)",
    (_name, order) => {
      const { bind } = renderSelections()
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
      bind(chart)
      act(() => {
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
    const { bind } = renderSelections()
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

    bind(chart)
    act(() => {
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

  it("commits a final polygon snapshot whose vertices differ from brushEnd", () => {
    const { bind } = renderSelections()
    const chart = createFakeChart()
    const endArea = {
      brushType: "polygon",
      coordRange: [
        [0, 0],
        [1, 0],
        [1, 1],
        [1, 1],
      ],
    }
    const finalArea = {
      brushType: "polygon",
      coordRange: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    }
    const finalBrush = createBrushSelection({
      areas: [finalArea],
      selected: selectedWithMainHits([1, 2]),
    })

    bind(chart)
    act(() => {
      chart.trigger("brushEnd", {
        brushId: finalBrush.brushId,
        areas: [endArea],
      })
      chart.trigger("brushSelected", { batch: [finalBrush] })
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
          brush_index: 0,
          brush_type: "polygon",
          coord_range: finalArea.coordRange,
        },
      ]
    )
  })

  it("waits for brushEnd before committing a non-empty brush snapshot", () => {
    const { bind } = renderSelections()
    const chart = createFakeChart()
    const brush = createBrushSelection({
      areas: [{ brushType: "lineX", coordRange: [1, 3] }],
      selected: selectedWithMainHits([1, 2]),
    })
    bind(chart)
    act(() => {
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

  it("does not rerun for an initial empty toolbox-activation snapshot", () => {
    const { bind } = renderSelections()
    const chart = createFakeChart()
    const emptyBrush = createBrushSelection({
      areas: [],
    })

    bind(chart)
    act(() => {
      chart.trigger("brushSelected", { batch: [emptyBrush] })
    })
    flush()

    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("handles toolbox clear without brushEnd and preserves native selection", () => {
    const { bind } = renderSelections()
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ id: "native", name: "Native" }],
    })
    bind(chart)
    act(() => {
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
    const { bind } = renderSelections()
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
    bind(chart)
    act(() => {
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
    const { bind } = renderSelections()
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
    bind(chart)
    act(() => {
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
    const { result, bind } = renderSelections()
    const chart = createFakeChart()

    bind(chart)
    act(() => {
      result.current.restoreSelection()
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
    const { result, bind } = renderSelections()
    const chart = createFakeChart()
    chart.dispatchAction.mockImplementation(
      (payload: Record<string, unknown>) => {
        if (payload.type === "select") {
          chart.trigger("selectchanged", { selected: selectedPoints })
        }
      }
    )
    bind(chart)
    act(() => {
      result.current.restoreSelection()
    })
    flush()

    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("does not emit while restoreSelection dispatches brush selection", () => {
    const brush = createBrushSelection({
      brushId: "brush-0",
      brushIndex: 0,
      areas: [{ brushType: "lineX", coordRange: [0, 2] }],
    })
    widgetMgr.getElementState.mockImplementation((_id: string, key: string) =>
      key === "brushSelection" ? [brush] : undefined
    )
    const { result, bind } = renderSelections()
    const chart = createFakeChart()
    chart.dispatchAction.mockImplementation(
      (payload: Record<string, unknown>) => {
        if (payload.type === "brush") {
          chart.trigger("brushSelected", { batch: [brush] })
        }
      }
    )
    bind(chart)
    act(() => {
      result.current.restoreSelection()
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
    const { bind } = renderSelections()
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ id: "sales", name: "Sales" }],
    })
    bind(chart)
    act(() => {
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
    const { bind } = renderSelections()
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ id: "sales", name: "Sales" }],
    })
    const area = { brushType: "lineX", coordRange: [0, 2] }
    const brush = createBrushSelection({
      areas: [area],
      selected: selectedWithMainHits([2]),
    })
    bind(chart)
    act(() => {
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
    const { bind } = renderSelections()
    const chart = createFakeChart()
    chart.getOption.mockReturnValue({
      series: [{ id: "sales", name: "Sales" }],
    })
    bind(chart)
    act(() => {
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
    widgetMgr.getStringValue.mockReturnValue(
      JSON.stringify({
        selection: {
          selected: [{ series_index: 0, data_indices: [2] }],
          areas: [],
        },
      })
    )
    const { bind } = renderSelections()
    const chart = createFakeChart()
    bind(chart)
    act(() => {
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
    const { bind } = renderSelections()
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
    bind(chart)
    act(() => {
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
    const { bind } = renderSelections()
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
    bind(chart)
    act(() => {
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

  it("clears a drag-completed lasso on a later double-click", () => {
    const { bind } = renderSelections()
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
    bind(chart)
    act(() => {
      triggerBrushGesture(chart, brush)
    })
    flush()
    expect(chart.dispatchAction).not.toHaveBeenCalledWith({
      type: "brush",
      areas: [],
    })
    ;(widgetMgr.setStringValue as Mock).mockClear()
    widgetMgr.getStringValue.mockReturnValue(
      JSON.stringify({
        selection: {
          selected: [],
          areas: [
            {
              brush_index: 0,
              brush_type: "polygon",
              coord_range: polygon.coordRange,
            },
          ],
        },
      })
    )
    chart.dispatchAction.mockClear()

    // ECharts 6 completes a drag-drawn lasso on mouseup with no paired
    // dblclick. The consume-once flag must expire so a later double-click
    // clears the finished lasso.
    act(() => {
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

  it("clears a finished lasso when the active polygon tool re-commits it", () => {
    const { bind } = renderSelections()
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
    bind(chart)
    act(() => {
      triggerBrushGesture(chart, brush)
    })
    flush()
    ;(widgetMgr.setStringValue as Mock).mockClear()
    widgetMgr.getStringValue.mockReturnValue(
      JSON.stringify({
        selection: {
          selected: [],
          areas: [
            {
              brush_index: 0,
              brush_type: "polygon",
              coord_range: polygon.coordRange,
            },
          ],
        },
      })
    )
    chart.dispatchAction.mockClear()

    // ECharts re-commits the same polygon when the active polygon tool
    // receives a second double-click. It must not be treated as a new polygon.
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

  it("writes selection immediately when the chart is in a form", () => {
    const { bind } = renderSelections(createElement("chart-id", "form-id"))
    const chart = createFakeChart()

    bind(chart)
    act(() => {
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [2] }],
      })
    })

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      "chart-id",
      JSON.stringify({
        selection: {
          selected: [
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "main",
              data_indices: [2],
            },
          ],
          areas: [],
        },
      }),
      { formId: "form-id", fragmentId: undefined, fromUser: true }
    )
  })

  it("flushes a pending form brush on submit before the delayed snapshot", () => {
    let submitValidator: () => boolean = () => true
    widgetMgr.addFormSubmitValidator.mockImplementation(
      (_formId: string, _widgetId: string, validator: () => boolean) => {
        submitValidator = validator
      }
    )
    const { bind } = renderSelections(createElement("chart-id", "form-id"))
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
    chart.dispatchAction.mockImplementation(
      (action: Record<string, unknown>) => {
        if (action.type === "brush") {
          chart.trigger("brushSelected", { batch: [brush] })
        }
      }
    )

    bind(chart)
    act(() => {
      chart.trigger("brushEnd", {
        brushId: brush.brushId,
        areas: brush.areas,
      })
    })

    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()

    act(() => {
      expect(submitValidator()).toBe(true)
    })

    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      brushId: brush.brushId,
      areas: brush.areas,
    })
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      "chart-id",
      JSON.stringify({
        selection: {
          selected: [
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "main",
              data_indices: [2],
            },
          ],
          areas: [
            {
              brush_index: 0,
              brush_type: "rect",
              coord_range: area.coordRange,
            },
          ],
        },
      }),
      { formId: "form-id", fragmentId: undefined, fromUser: true }
    )

    ;(widgetMgr.setStringValue as Mock).mockClear()
    widgetMgr.getStringValue.mockReturnValue(
      JSON.stringify({
        selection: {
          selected: [
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "main",
              data_indices: [2],
            },
          ],
          areas: [
            {
              brush_index: 0,
              brush_type: "rect",
              coord_range: area.coordRange,
            },
          ],
        },
      })
    )

    act(() => {
      chart.trigger("brushSelected", { batch: [brush] })
    })

    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("does not submit the previous brush indices when the hit-test stays pending", () => {
    let submitValidator: () => boolean = () => true
    widgetMgr.addFormSubmitValidator.mockImplementation(
      (_formId: string, _widgetId: string, validator: () => boolean) => {
        submitValidator = validator
      }
    )
    const { bind } = renderSelections(createElement("chart-id", "form-id"))
    const chart = createFakeChart()
    const clearScheduledHitTest = vi.fn()
    ;(
      chart.zr as { __ecBrushSelect?: { clear: () => void } }
    ).__ecBrushSelect = { clear: clearScheduledHitTest }
    const previousArea = {
      brushType: "rect",
      coordRange: [
        [0, 1],
        [0, 1],
      ],
    }
    const nextArea = {
      brushType: "rect",
      coordRange: [
        [4, 5],
        [4, 5],
      ],
    }
    const previous = createBrushSelection({
      areas: [previousArea],
      selected: selectedWithMainHits([1]),
    })
    const next = createBrushSelection({
      areas: [nextArea],
      selected: selectedWithMainHits([4]),
    })

    bind(chart)
    act(() => {
      triggerBrushGesture(chart, previous)
    })
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    ;(widgetMgr.setStringValue as Mock).mockClear()

    act(() => {
      chart.trigger("brushEnd", {
        brushId: previous.brushId,
        areas: [nextArea],
      })
    })

    act(() => {
      expect(submitValidator()).toBe(false)
    })

    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      brushIndex: previous.brushIndex,
      areas: [nextArea],
    })
    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
    expect(clearScheduledHitTest).not.toHaveBeenCalled()

    act(() => {
      chart.trigger("brushSelected", { batch: [next] })
    })

    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      "chart-id",
      JSON.stringify({
        selection: {
          selected: [
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "main",
              data_indices: [4],
            },
          ],
          areas: [
            {
              brush_index: 0,
              brush_type: "rect",
              coord_range: nextArea.coordRange,
            },
          ],
        },
      }),
      { formId: "form-id", fragmentId: undefined, fromUser: true }
    )

    act(() => {
      expect(submitValidator()).toBe(true)
    })
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("hit-tests a pending form brush with the user's throttle disabled", () => {
    let submitValidator: () => boolean = () => true
    widgetMgr.addFormSubmitValidator.mockImplementation(
      (_formId: string, _widgetId: string, validator: () => boolean) => {
        submitValidator = validator
      }
    )
    const { bind } = renderSelections(createElement("chart-id", "form-id"))
    const chart = createFakeChart()
    const brushOption = { throttleType: "debounce", throttleDelay: 400 }
    const brushModel = { option: { ...brushOption } }
    const clearScheduledHitTest = vi.fn()
    ;(chart as unknown as { getModel: () => unknown }).getModel = () => ({
      eachComponent: (
        _query: { mainType: string },
        callback: (model: { option: typeof brushOption }) => void
      ) => {
        callback(brushModel)
      },
    })
    ;(
      chart.zr as { __ecBrushSelect?: { clear: () => void } }
    ).__ecBrushSelect = { clear: clearScheduledHitTest }
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
    let throttleDuringDispatch:
      | { throttleType?: string; throttleDelay?: number }
      | undefined
    chart.dispatchAction.mockImplementation(action => {
      if (action.type === "brush") {
        throttleDuringDispatch = { ...brushModel.option }
        chart.trigger("brushSelected", { batch: [brush] })
      }
    })

    bind(chart)
    act(() => {
      chart.trigger("brushEnd", {
        brushId: brush.brushId,
        areas: brush.areas,
      })
    })

    act(() => {
      expect(submitValidator()).toBe(true)
    })

    expect(throttleDuringDispatch).toEqual({
      throttleType: "fixRate",
      throttleDelay: 0,
    })
    expect(brushModel.option).toEqual(brushOption)
    expect(clearScheduledHitTest).toHaveBeenCalledTimes(1)
    expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
      "chart-id",
      JSON.stringify({
        selection: {
          selected: [
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "main",
              data_indices: [2],
            },
          ],
          areas: [
            {
              brush_index: 0,
              brush_type: "rect",
              coord_range: area.coordRange,
            },
          ],
        },
      }),
      { formId: "form-id", fragmentId: undefined, fromUser: true }
    )
  })

  it("submits final indices for a throttled form brush on the submit turn", () => {
    let submitValidator: () => boolean = () => true
    widgetMgr.addFormSubmitValidator.mockImplementation(
      (_formId: string, _widgetId: string, validator: () => boolean) => {
        submitValidator = validator
      }
    )
    const chart = echarts.init(null, null, {
      renderer: "svg",
      ssr: true,
      width: 600,
      height: 400,
    })
    try {
      chart.setOption({
        animation: false,
        xAxis: { type: "value" },
        yAxis: { type: "value" },
        brush: {
          xAxisIndex: "all",
          yAxisIndex: "all",
          throttleType: "fixRate",
          throttleDelay: 0,
        },
        series: {
          type: "scatter",
          data: [
            [0, 0],
            [1, 1],
            [5, 5],
          ],
        },
      })
      // Learn the brushEnd shape ECharts actually emits (pixel range plus
      // panel id). A coordRange-only area does not compare equal to the
      // hit-test snapshot.
      const finishedAreas = captureBrushAreas(chart, [
        {
          brushType: "rect",
          coordRange: [
            [-1, 10],
            [-1, 10],
          ],
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
      ])
      const brushModel = readBrushModel(chart)
      brushModel.option.throttleType = "debounce"
      brushModel.option.throttleDelay = 10_000

      const { bind } = renderSelections(createElement("chart-id", "form-id"))

      bind(chart)
      act(() => {
        // Throttled in-progress snapshot. It must not win over the finished
        // areas once submit asks for a fresh hit-test.
        chart.dispatchAction({
          type: "brush",
          brushId: brushModel.id,
          areas: [],
        })
        chart.dispatchAction({
          type: "brushEnd",
          brushId: brushModel.id,
          areas: finishedAreas,
        })
      })

      expect(widgetMgr.setStringValue).not.toHaveBeenCalled()

      act(() => {
        expect(submitValidator()).toBe(true)
      })

      expect(brushModel.option).toMatchObject({
        throttleType: "debounce",
        throttleDelay: 10_000,
      })
      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
      expect(widgetMgr.setStringValue).toHaveBeenCalledWith(
        "chart-id",
        JSON.stringify({
          selection: {
            selected: [
              {
                series_index: 0,
                series_id: null,
                series_name: null,
                data_type: "main",
                data_indices: [0, 1, 2],
              },
            ],
            areas: [
              {
                brush_index: 0,
                brush_type: "rect",
                coord_range: [
                  [-1, 10],
                  [-1, 10],
                ],
              },
            ],
          },
        }),
        { formId: "form-id", fragmentId: undefined, fromUser: true }
      )

      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    } finally {
      chart.dispose()
    }
  })

  it("commits a throttled brush when its handlers unbind before brushSelected", () => {
    const chart = echarts.init(null, null, {
      renderer: "svg",
      ssr: true,
      width: 600,
      height: 400,
    })
    try {
      chart.setOption({
        animation: false,
        xAxis: { type: "value" },
        yAxis: { type: "value" },
        brush: {
          xAxisIndex: "all",
          yAxisIndex: "all",
          throttleType: "fixRate",
          throttleDelay: 0,
        },
        series: {
          type: "scatter",
          data: [
            [0, 0],
            [1, 1],
            [5, 5],
          ],
        },
      })
      const finishedAreas = captureBrushAreas(chart, [
        {
          brushType: "rect",
          coordRange: [
            [-1, 10],
            [-1, 10],
          ],
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
      ])
      const brushModel = readBrushModel(chart)
      brushModel.option.throttleType = "debounce"
      brushModel.option.throttleDelay = 10_000

      const { bind, unbind } = renderSelections()

      bind(chart)
      act(() => {
        chart.dispatchAction({
          type: "brush",
          brushId: brushModel.id,
          areas: [],
        })
        chart.dispatchAction({
          type: "brushEnd",
          brushId: brushModel.id,
          areas: finishedAreas,
        })
      })
      flush()

      // The finished gesture is still waiting on the throttled snapshot.
      expect(widgetMgr.setStringValue).not.toHaveBeenCalled()

      act(() => {
        unbind()
      })

      expect(brushModel.option).toMatchObject({
        throttleType: "debounce",
        throttleDelay: 10_000,
      })
      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
      expectSelectionWrite(
        [
          {
            series_index: 0,
            series_id: null,
            series_name: null,
            data_type: "main",
            data_indices: [0, 1, 2],
          },
        ],
        [
          {
            brush_index: 0,
            brush_type: "rect",
            coord_range: [
              [-1, 10],
              [-1, 10],
            ],
          },
        ]
      )

      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    } finally {
      chart.dispose()
    }
  })

  it("does not hit-test a pending brush on cleanup after the chart is disposed", () => {
    const { bind, unbind } = renderSelections()
    const chart = createFakeChart()
    const brush = createBrushSelection({
      areas: [{ brushType: "lineX", coordRange: [0, 2] }],
    })

    bind(chart)
    act(() => {
      chart.trigger("brushEnd", {
        brushId: brush.brushId,
        areas: brush.areas,
      })
    })

    chart.isDisposed.mockReturnValue(true)
    act(() => {
      unbind()
    })

    expect(chart.dispatchAction).not.toHaveBeenCalled()
    expect(widgetMgr.setStringValue).not.toHaveBeenCalled()
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
    const { bind } = renderSelections(createElement("chart-id", "form-id"))
    const chart = createFakeChart()
    expect(widgetMgr.addFormClearedListener).toHaveBeenCalledWith(
      "form-id",
      expect.any(Function)
    )
    const [, handleFormCleared] = (widgetMgr.addFormClearedListener as Mock)
      .mock.calls[0] as [string, () => void]

    chart.dispatchAction.mockImplementation(
      (payload: Record<string, unknown>) => {
        if (payload.type === "unselect" || payload.type === "brush") {
          chart.trigger("selectchanged", { selected: [] })
        }
      }
    )
    bind(chart)
    act(() => {
      chart.trigger("selectchanged", {
        selected: [{ seriesIndex: 0, dataIndex: [2] }],
      })
      handleFormCleared()
    })
    flush()

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
    expect(widgetMgr.setStringValue).toHaveBeenNthCalledWith(
      1,
      "chart-id",
      JSON.stringify({
        selection: {
          selected: [
            {
              series_index: 0,
              series_id: null,
              series_name: null,
              data_type: "main",
              data_indices: [2],
            },
          ],
          areas: [],
        },
      }),
      { formId: "form-id", fragmentId: undefined, fromUser: true }
    )
    expect(widgetMgr.setStringValue).toHaveBeenNthCalledWith(
      2,
      "chart-id",
      JSON.stringify({ selection: { selected: [], areas: [] } }),
      { formId: "form-id", fragmentId: undefined, fromUser: true }
    )
    expect(widgetMgr.setStringValue).toHaveBeenCalledTimes(2)
  })
})
