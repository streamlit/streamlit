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

import { type ReactElement, useMemo } from "react"

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import {
  Float64,
  Table,
  tableToIPC,
  Utf8,
  vectorFromArray,
} from "apache-arrow"

import {
  type ArrowNamedDataSet,
  EChartsChart as EChartsChartProto,
} from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { EChartsChart } from "./EChartsChart"
import { resetPageWheelClockForTests } from "./insideDataZoomWheel"

const { mockInit, mockChart } = vi.hoisted(() => {
  const mockChart = {
    setOption: vi.fn(),
    setTheme: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    isDisposed: vi.fn(() => false),
    getDataURL: vi.fn(() => "data:image/png;base64,AAA"),
    on: vi.fn(),
    off: vi.fn(),
    getZr: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
    dispatchAction: vi.fn(),
    convertFromPixel: vi.fn(),
    getOption: vi.fn(() => ({})),
  }
  return {
    mockInit: vi.fn(
      (_dom?: unknown, _theme?: unknown, _opts?: unknown) => mockChart
    ),
    mockChart,
  }
})

const { mockContainerRef } = vi.hoisted(() => ({
  mockContainerRef: { current: null as HTMLDivElement | null },
}))

/** Lets a test override the emotion theme to simulate a runtime theme switch. */
const { themeHolder } = vi.hoisted(() => {
  const themeHolder: { override: unknown } = { override: null }
  return { themeHolder }
})

vi.mock("echarts", () => ({
  init: mockInit,
}))

/** Lets a test change the measured size to simulate a container resize. */
const { dimensionsHolder } = vi.hoisted(() => ({
  dimensionsHolder: { width: 600, height: 400 },
}))

vi.mock("~lib/hooks/useCalculatedDimensions", () => ({
  useCalculatedDimensions: () => ({
    width: dimensionsHolder.width,
    height: dimensionsHolder.height,
    elementRef: mockContainerRef,
  }),
}))

vi.mock("~lib/hooks/useEmotionTheme", () => ({
  useEmotionTheme: () => themeHolder.override ?? mockTheme.emotion,
}))

vi.mock("~lib/components/widgets/Form/FormClearHelper", () => ({
  FormClearHelper: vi.fn().mockImplementation(() => ({
    manageFormClearListener: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

const DEFAULT_SPEC = JSON.stringify({
  xAxis: { type: "category", data: ["A", "B", "C"] },
  yAxis: { type: "value" },
  series: [{ type: "bar", data: [1, 2, 3] }],
})

function createElement(
  overrides: Partial<EChartsChartProto> = {}
): EChartsChartProto {
  return new EChartsChartProto({
    spec: DEFAULT_SPEC,
    theme: "streamlit",
    renderer: EChartsChartProto.Renderer.CANVAS,
    id: "",
    formId: "",
    ...overrides,
  })
}

function applyMockEchartsAria(option: Record<string, unknown>): void {
  const dom = mockContainerRef.current
  if (!dom) {
    return
  }
  const aria = option.aria as
    | {
        enabled?: boolean
        label?: { enabled?: boolean; description?: string }
      }
    | undefined
  const enabled = aria?.enabled !== false
  if (!enabled) {
    // ECharts 6.1 leaves stale role/aria-label behind when ARIA is disabled.
    return
  }
  // ECharts setLabel returns before writing role/aria-label when label.enabled
  // is false.
  if (aria?.label?.enabled === false) {
    return
  }
  dom.setAttribute("role", "img")
  const description = aria?.label?.description
  if (typeof description === "string" && description.length > 0) {
    dom.setAttribute("aria-label", description)
    return
  }
  const series = option.series
  const seriesList = Array.isArray(series) ? series : series ? [series] : []
  const hasPoints = seriesList.some(entry => {
    if (!entry || typeof entry !== "object") {
      return false
    }
    const data = (entry as { data?: unknown }).data
    return Array.isArray(data) && data.length > 0
  })
  if (hasPoints) {
    dom.setAttribute("aria-label", "This is a chart.")
  }
  // ECharts 6.1 returns without clearing aria-label when seriesCnt < 1.
}

describe("EChartsChart", () => {
  let widgetMgr: WidgetStateManager

  const Wrapper = ({
    element,
    isFullScreen = false,
    disabled = false,
  }: {
    element: EChartsChartProto
    isFullScreen?: boolean
    disabled?: boolean
  }): ReactElement => {
    const contextValue = useMemo(
      () => ({
        expanded: isFullScreen,
        width: 600,
        height: 400,
        expand: vi.fn(),
        collapse: vi.fn(),
      }),
      [isFullScreen]
    )
    return (
      <ElementFullscreenContext.Provider value={contextValue}>
        <EChartsChart
          element={element}
          widgetMgr={widgetMgr}
          disabled={disabled}
        />
      </ElementFullscreenContext.Provider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resetPageWheelClockForTests()
    mockContainerRef.current = null
    themeHolder.override = null
    dimensionsHolder.width = 600
    dimensionsHolder.height = 400
    // Restore the shared-instance default; a test below overrides it locally.
    mockInit.mockImplementation(() => mockChart)
    mockChart.isDisposed.mockReturnValue(false)
    mockChart.setOption.mockImplementation(
      (option: Record<string, unknown>) => {
        applyMockEchartsAria(option)
      }
    )
    widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    })
  })

  it("initializes an ECharts instance and applies the option", () => {
    render(<Wrapper element={createElement()} />)

    expect(mockInit).toHaveBeenCalledTimes(1)
    const [, themeArg, initOpts] = mockInit.mock.calls[0]
    expect(themeArg).toBeDefined()
    expect(initOpts).toEqual({ renderer: "canvas" })

    expect(mockChart.setOption).toHaveBeenCalledTimes(1)
    const [appliedOption, applyOpts] = mockChart.setOption.mock.calls[0]
    expect(applyOpts).toEqual({ notMerge: true })
    // Streamlit theming defaults were applied non-destructively.
    expect(appliedOption.aria).toEqual({ enabled: true })
    expect(appliedOption.series[0].cursor).toBe("default")
    // The resize that coincides with init is skipped (echarts sizes at init),
    // avoiding a benign "resize during main process" warning.
    expect(mockChart.resize).not.toHaveBeenCalled()
    expect(screen.getByTestId("stEChartsChart")).toBeVisible()
  })

  it("resizes when the container size changes after init", () => {
    const { rerender } = render(<Wrapper element={createElement()} />)
    expect(mockChart.resize).not.toHaveBeenCalled()

    dimensionsHolder.width = 800
    rerender(<Wrapper element={createElement()} />)

    expect(mockChart.resize).toHaveBeenCalledTimes(1)
  })

  it("prunes pixel-only brush when a new instance inits at a different size", () => {
    const createIsolatedMockChart = (): typeof mockChart => {
      const chart = {
        setOption: vi.fn((option: Record<string, unknown>) => {
          applyMockEchartsAria(option)
        }),
        setTheme: vi.fn(),
        resize: vi.fn(),
        dispose: vi.fn(() => {
          chart.isDisposed.mockReturnValue(true)
        }),
        isDisposed: vi.fn(() => false),
        getDataURL: vi.fn(() => "data:image/png;base64,AAA"),
        on: vi.fn(),
        off: vi.fn(),
        getZr: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
        dispatchAction: vi.fn(),
        convertFromPixel: vi.fn(),
        getOption: vi.fn(() => ({})),
      }
      return chart
    }
    const firstChart = createIsolatedMockChart()
    const secondChart = createIsolatedMockChart()
    mockInit
      .mockImplementationOnce(() => firstChart)
      .mockImplementationOnce(() => secondChart)

    const element = createElement({
      id: "chart-id",
      selectionActivated: true,
    })
    const { rerender } = render(<Wrapper element={element} />)
    expect(mockInit).toHaveBeenCalledTimes(1)
    expect(firstChart.resize).not.toHaveBeenCalled()

    widgetMgr.setElementState("chart-id", "brushSelection", [
      {
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
        selected: [],
      },
    ])

    dimensionsHolder.width = 800
    dimensionsHolder.height = 500
    rerender(
      <Wrapper
        element={createElement({
          id: "chart-id",
          selectionActivated: true,
          renderer: EChartsChartProto.Renderer.SVG,
        })}
      />
    )

    expect(mockInit).toHaveBeenCalledTimes(2)
    expect(secondChart.resize).not.toHaveBeenCalled()
    expect(secondChart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      brushIndex: 0,
      areas: [],
    })
  })

  it("resizes on the first positive size after a 0x0 init", () => {
    const { rerender } = render(<Wrapper element={createElement()} />)
    expect(mockInit).toHaveBeenCalledTimes(1)
    mockChart.resize.mockClear()

    // Recreate the instance (a renderer switch is the one change still fixed
    // at init time) while the hook reports 0x0, as during a layout reflow.
    const svgElement = createElement({
      renderer: EChartsChartProto.Renderer.SVG,
    })
    dimensionsHolder.width = 0
    dimensionsHolder.height = 0
    rerender(<Wrapper element={svgElement} />)
    expect(mockInit).toHaveBeenCalledTimes(2)
    expect(mockChart.resize).not.toHaveBeenCalled()

    dimensionsHolder.width = 600
    dimensionsHolder.height = 400
    rerender(<Wrapper element={svgElement} />)
    expect(mockChart.resize).toHaveBeenCalledTimes(1)
  })

  it("does not dispose the instance when dimensions transiently report 0", () => {
    const { rerender } = render(<Wrapper element={createElement()} />)
    mockChart.resize.mockClear()
    const disposeCalls = mockChart.dispose.mock.calls.length

    dimensionsHolder.width = 0
    dimensionsHolder.height = 0
    rerender(<Wrapper element={createElement()} />)

    expect(mockChart.dispose).toHaveBeenCalledTimes(disposeCalls)
    expect(mockChart.resize).not.toHaveBeenCalled()
  })

  it("does not bind selection handlers when disabled", () => {
    widgetMgr.setElementState("chart-id", "selectedPoints", [
      { seriesIndex: 0, dataIndex: [0] },
    ])
    widgetMgr.setElementState("chart-id", "brushSelection", [
      {
        brushId: "brush-0",
        brushIndex: 0,
        areas: [{ brushType: "lineX", coordRange: [0, 2] }],
        selected: [],
      },
    ])

    render(
      <Wrapper
        element={createElement({ id: "chart-id", selectionActivated: true })}
        disabled={true}
      />
    )

    expect(mockInit).toHaveBeenCalledTimes(1)
    expect(mockChart.on).not.toHaveBeenCalled()
    // Disabled bind still restores the overlay so a disconnect / setOption
    // cannot drop the highlight. Handlers stay unbound.
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: "select",
      seriesIndex: 0,
      dataIndex: [0],
    })
    expect(mockChart.dispatchAction).toHaveBeenCalledWith({
      type: "brush",
      brushIndex: 0,
      areas: [{ brushType: "lineX", coordRange: [0, 2] }],
    })
  })

  it("disables pointer events on a disabled selection widget", () => {
    render(
      <Wrapper
        element={createElement({ id: "chart-id", selectionActivated: true })}
        disabled={true}
      />
    )

    expect(screen.getByTestId("stEChartsChart")).toHaveStyle({
      pointerEvents: "none",
    })
  })

  it("keeps pointer events on a display-only chart when the host is disabled", () => {
    render(
      <Wrapper
        element={createElement({ id: "styled_chart" })}
        disabled={true}
      />
    )

    expect(screen.getByTestId("stEChartsChart")).not.toHaveStyle({
      pointerEvents: "none",
    })
  })

  it("does not bind selection handlers for a keyed display-only chart", () => {
    render(
      <Wrapper
        element={createElement({
          id: "styled_chart",
          spec: JSON.stringify({
            xAxis: { type: "category", data: ["A", "B", "C"] },
            yAxis: { type: "value" },
            series: [{ type: "bar", data: [1, 2, 3], selectedMode: true }],
          }),
        })}
      />
    )

    expect(mockInit).toHaveBeenCalledTimes(1)
    expect(mockChart.on).not.toHaveBeenCalled()
  })

  it("binds selection handlers when selection is activated", () => {
    render(
      <Wrapper
        element={createElement({ id: "chart-id", selectionActivated: true })}
      />
    )

    expect(mockChart.on).toHaveBeenCalled()
  })

  it("renders display-only charts (empty id) without binding selection handlers", () => {
    render(<Wrapper element={createElement({ id: "" })} />)

    expect(mockInit).toHaveBeenCalledTimes(1)
    expect(mockChart.on).not.toHaveBeenCalled()
    expect(screen.queryByTestId("stEChartsChartError")).not.toBeInTheDocument()
  })

  it("passes the SVG renderer through to echarts.init", () => {
    render(
      <Wrapper
        element={createElement({ renderer: EChartsChartProto.Renderer.SVG })}
      />
    )

    expect(mockInit.mock.calls[0][2]).toEqual({ renderer: "svg" })
  })

  it("does not pass a theme object when theme is None", () => {
    render(<Wrapper element={createElement({ theme: "" })} />)

    expect(mockInit.mock.calls[0][1]).toBeUndefined()
    // theme=None skips visual styling but keeps the accessibility default.
    const [appliedOption] = mockChart.setOption.mock.calls[0]
    expect(appliedOption.aria).toEqual({ enabled: true })
    expect(appliedOption.grid).toBeUndefined()
  })

  it.each([
    ["the Streamlit theme", "streamlit"],
    ["theme=None", ""],
  ])("turns string tooltip formatters into functions with %s", (_, theme) => {
    const spec = JSON.stringify({
      ...JSON.parse(DEFAULT_SPEC),
      tooltip: { formatter: "{b}: {@[1]}", valueFormatter: "%d units" },
    })
    render(<Wrapper element={createElement({ spec, theme })} />)

    const [appliedOption] = mockChart.setOption.mock.calls[0]
    expect(appliedOption.tooltip.formatter).toBeTypeOf("function")
    expect(appliedOption.tooltip.valueFormatter(5)).toBe("5 units")
  })

  it("leaves the chart container's role to ECharts", () => {
    render(<Wrapper element={createElement()} />)

    // ECharts sets role="img" and an aria-label on this same element when
    // aria.enabled is on. We do not declare the role in JSX, so users who
    // opt out can have those attributes reconciled away.
    const chart = screen.getByTestId("stEChartsChart")
    expect(chart).toHaveAttribute("role", "img")
    expect(chart).toHaveAttribute("aria-label")
  })

  it("clears stale ECharts ARIA when a later option disables it", () => {
    const { rerender } = render(<Wrapper element={createElement()} />)
    const chart = screen.getByTestId("stEChartsChart")
    expect(chart).toHaveAttribute("role", "img")

    const spec = JSON.stringify({
      ...JSON.parse(DEFAULT_SPEC),
      aria: { enabled: false },
    })
    rerender(<Wrapper element={createElement({ spec })} />)

    expect(chart).not.toHaveAttribute("role")
    expect(chart).not.toHaveAttribute("aria-label")
  })

  it("drops an unnamed role=img on an empty series", () => {
    const spec = JSON.stringify({
      xAxis: { type: "category", data: [] },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: [] }],
    })
    render(<Wrapper element={createElement({ spec })} />)

    expect(screen.getByTestId("stEChartsChart")).not.toHaveAttribute("role")
  })

  it("sets the accessible name from proto alt", () => {
    render(
      <Wrapper element={createElement({ alt: "Bar chart of categories" })} />
    )

    const [appliedOption] = mockChart.setOption.mock.calls[0]
    expect(appliedOption.aria).toEqual({
      enabled: true,
      label: { enabled: true, description: "Bar chart of categories" },
    })
    const chart = screen.getByTestId("stEChartsChart")
    expect(chart).toHaveAttribute("role", "img")
    expect(chart).toHaveAccessibleName("Bar chart of categories")
  })

  it("keeps an accessible name from alt on an empty series", () => {
    const spec = JSON.stringify({
      xAxis: { type: "category", data: [] },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: [] }],
    })
    render(
      <Wrapper
        element={createElement({ spec, alt: "Empty bar chart placeholder" })}
      />
    )

    const chart = screen.getByTestId("stEChartsChart")
    expect(chart).toHaveAttribute("role", "img")
    expect(chart).toHaveAccessibleName("Empty bar chart placeholder")
  })

  it("clears a previous alt when it is omitted on an empty series", () => {
    // Keyed charts reuse zr.dom. ECharts 6.1 leaves a prior aria-label when
    // the next option has no description and no series data.
    const emptySpec = JSON.stringify({
      xAxis: { type: "category", data: [] },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: [] }],
    })
    const { rerender } = render(
      <Wrapper
        element={createElement({
          spec: emptySpec,
          alt: "Temporary loading label",
          id: "stable_empty",
        })}
      />
    )
    const chart = screen.getByTestId("stEChartsChart")
    expect(chart).toHaveAccessibleName("Temporary loading label")

    rerender(
      <Wrapper
        element={createElement({
          spec: emptySpec,
          id: "stable_empty",
        })}
      />
    )

    expect(chart).not.toHaveAttribute("aria-label")
    expect(chart).not.toHaveAttribute("role")
  })

  it("forces aria.enabled when alt is set even if the option disables it", () => {
    const spec = JSON.stringify({
      ...JSON.parse(DEFAULT_SPEC),
      aria: { enabled: false },
    })
    render(
      <Wrapper
        element={createElement({ spec, alt: "Named despite aria disabled" })}
      />
    )

    const [appliedOption] = mockChart.setOption.mock.calls[0]
    expect(appliedOption.aria.enabled).toBe(true)
    expect(appliedOption.aria.label.enabled).toBe(true)
    expect(appliedOption.aria.label.description).toBe(
      "Named despite aria disabled"
    )
    expect(screen.getByTestId("stEChartsChart")).toHaveAccessibleName(
      "Named despite aria disabled"
    )
  })

  it("overrides an author aria.label.description with alt", () => {
    const spec = JSON.stringify({
      ...JSON.parse(DEFAULT_SPEC),
      aria: {
        enabled: true,
        label: { description: "Author description" },
      },
    })
    render(<Wrapper element={createElement({ spec, alt: "Streamlit alt" })} />)

    const [appliedOption] = mockChart.setOption.mock.calls[0]
    expect(appliedOption.aria.label.enabled).toBe(true)
    expect(appliedOption.aria.label.description).toBe("Streamlit alt")
    expect(screen.getByTestId("stEChartsChart")).toHaveAccessibleName(
      "Streamlit alt"
    )
  })

  it("disposes and re-initializes the instance when the renderer changes", () => {
    const { rerender } = render(<Wrapper element={createElement()} />)
    expect(mockInit).toHaveBeenCalledTimes(1)

    rerender(
      <Wrapper
        element={createElement({ renderer: EChartsChartProto.Renderer.SVG })}
      />
    )

    expect(mockChart.dispose).toHaveBeenCalledTimes(1)
    expect(mockInit).toHaveBeenCalledTimes(2)
    expect(mockInit.mock.calls[1][2]).toEqual({ renderer: "svg" })
  })

  it("re-themes in place instead of recreating the instance on a runtime theme switch", () => {
    // Return a distinct instance per init call, each tracking its own disposed
    // state, so we can assert the new instance (not the disposed old one) is the
    // one that receives the option.
    const charts: Array<ReturnType<typeof createChartInstance>> = []
    function createChartInstance(): typeof mockChart & { disposed: boolean } {
      const chart = {
        ...mockChart,
        disposed: false,
        setOption: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      }
      chart.dispose = vi.fn(() => {
        chart.disposed = true
      })
      chart.isDisposed = vi.fn(() => chart.disposed)
      return chart
    }
    mockInit.mockImplementation(() => {
      const chart = createChartInstance()
      charts.push(chart)
      return chart
    })

    const element = createElement()
    const { rerender } = render(<Wrapper element={element} />)
    expect(charts).toHaveLength(1)
    expect(charts[0].setOption).toHaveBeenCalledTimes(1)

    // Simulate a settings-menu theme switch: the emotion theme object identity
    // changes (same colors), so a new theme object is built.
    themeHolder.override = { ...mockTheme.emotion }
    rerender(<Wrapper element={element} />)

    // The instance is re-themed in place rather than recreated, so there is no
    // dispose flash and no entry-animation replay.
    expect(charts[0].setTheme).toHaveBeenCalledTimes(1)
    expect(charts[0].dispose).not.toHaveBeenCalled()
    expect(charts).toHaveLength(1)
    // The option model survives `setTheme`, so it isn't re-applied.
    expect(charts[0].setOption).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("stEChartsChartError")).not.toBeInTheDocument()
  })

  it("reverts to ECharts' built-in theme when theme becomes None", () => {
    const { rerender } = render(<Wrapper element={createElement()} />)
    expect(mockChart.setTheme).not.toHaveBeenCalled()

    rerender(<Wrapper element={createElement({ theme: "" })} />)

    expect(mockChart.setTheme).toHaveBeenCalledWith("default")
    expect(mockChart.dispose).not.toHaveBeenCalled()
  })

  it("retries a failed setTheme and clears the error overlay on recovery", () => {
    mockChart.setTheme.mockImplementationOnce(() => {
      throw new Error("theme failed")
    })

    const { rerender } = render(<Wrapper element={createElement()} />)
    expect(screen.queryByTestId("stEChartsChartError")).not.toBeInTheDocument()

    // Keep the option identity stable so a successful setOption cannot mask
    // the theme error. A settings-menu switch rebuilds the theme object.
    themeHolder.override = { ...mockTheme.emotion }
    rerender(<Wrapper element={createElement()} />)
    expect(screen.getByTestId("stEChartsChartError")).toBeVisible()
    expect(mockChart.setTheme).toHaveBeenCalledTimes(1)

    // A new theme object retries setTheme. appliedThemeRef must not have been
    // advanced on the failed attempt, or this retry would be skipped.
    themeHolder.override = { ...mockTheme.emotion }
    rerender(<Wrapper element={createElement()} />)
    expect(mockChart.setTheme).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId("stEChartsChartError")).not.toBeInTheDocument()
  })

  it("does not clear a theme error when a later resize succeeds", () => {
    mockChart.setTheme.mockImplementationOnce(() => {
      throw new Error("theme failed")
    })

    const { rerender } = render(<Wrapper element={createElement()} />)
    themeHolder.override = { ...mockTheme.emotion }
    rerender(<Wrapper element={createElement()} />)
    expect(screen.getByTestId("stEChartsChartError")).toHaveTextContent(
      "theme failed"
    )

    dimensionsHolder.width = 800
    rerender(<Wrapper element={createElement()} />)
    expect(screen.getByTestId("stEChartsChartError")).toHaveTextContent(
      "theme failed"
    )
  })

  it("skips no-op setOption calls on unrelated reruns", () => {
    const { rerender } = render(<Wrapper element={createElement()} />)
    expect(mockChart.setOption).toHaveBeenCalledTimes(1)

    // A new proto instance with an identical spec simulates an unrelated rerun.
    rerender(<Wrapper element={createElement()} />)

    expect(mockChart.setOption).toHaveBeenCalledTimes(1)
    expect(mockChart.dispose).not.toHaveBeenCalled()
  })

  it("renders a styled error instead of throwing when setOption fails", () => {
    mockChart.setOption.mockImplementationOnce(() => {
      throw new Error("invalid option")
    })

    render(<Wrapper element={createElement()} />)

    const error = screen.getByTestId("stEChartsChartError")
    expect(error).toBeVisible()
    expect(error).toHaveTextContent("invalid option")
  })

  it("renders a styled error instead of throwing when echarts.init fails", () => {
    mockInit.mockImplementationOnce(() => {
      throw new Error("init failed")
    })

    render(<Wrapper element={createElement()} />)

    const error = screen.getByTestId("stEChartsChartError")
    expect(error).toBeVisible()
    expect(error).toHaveTextContent("init failed")
    expect(mockChart.setOption).not.toHaveBeenCalled()
  })

  it("renders a styled error instead of throwing when a resize fails", () => {
    const { rerender } = render(<Wrapper element={createElement()} />)

    // `resize` re-runs the render pipeline, so an option that ECharts cannot
    // render throws here too. Escaping the effect would trip the error boundary
    // and replace the chart with an unrecoverable stack trace.
    mockChart.resize.mockImplementationOnce(() => {
      throw new Error("resize failed")
    })
    dimensionsHolder.width = 800
    rerender(<Wrapper element={createElement()} />)

    expect(mockChart.resize).toHaveBeenCalledTimes(1)
    const error = screen.getByTestId("stEChartsChartError")
    expect(error).toBeVisible()
    expect(error).toHaveTextContent("resize failed")
  })

  it("clears a resize error after a later successful resize", () => {
    mockChart.resize.mockImplementationOnce(() => {
      throw new Error("resize failed")
    })
    const { rerender } = render(<Wrapper element={createElement()} />)
    dimensionsHolder.width = 800
    rerender(<Wrapper element={createElement()} />)
    expect(screen.getByTestId("stEChartsChartError")).toBeVisible()

    dimensionsHolder.width = 900
    rerender(<Wrapper element={createElement()} />)
    expect(screen.queryByTestId("stEChartsChartError")).not.toBeInTheDocument()
  })

  it("renders a styled error for an unparseable spec", () => {
    render(<Wrapper element={createElement({ spec: "{not json" })} />)

    expect(screen.getByTestId("stEChartsChartError")).toBeVisible()
    // No chart should be created for an invalid spec.
    expect(mockInit).not.toHaveBeenCalled()
    expect(screen.queryByTestId("stEChartsChart")).not.toBeInTheDocument()
  })

  it("does not inject a tooltip formatter or renderMode (XSS-safe)", () => {
    const spec = JSON.stringify({
      xAxis: { type: "category", data: ["A"] },
      yAxis: { type: "value" },
      tooltip: { trigger: "axis" },
      series: [
        {
          type: "bar",
          data: [{ value: 1, name: "<img src=x onerror=alert(1)>" }],
        },
      ],
    })

    render(<Wrapper element={createElement({ spec })} />)

    const [appliedOption] = mockChart.setOption.mock.calls[0]
    expect(appliedOption.tooltip.formatter).toBeUndefined()
    expect(appliedOption.tooltip.renderMode).toBeUndefined()
    expect(appliedOption.tooltip).toEqual({ trigger: "axis" })
  })

  it("exports the chart as a PNG with a timestamped filename", async () => {
    const user = userEvent.setup()
    let downloadFilename: string | null = null
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadFilename = this.download
      })

    render(<Wrapper element={createElement()} />)

    await user.click(screen.getByRole("button", { name: "Download as PNG" }))

    expect(mockChart.getDataURL).toHaveBeenCalledWith({
      type: "png",
      pixelRatio: 2,
      backgroundColor: mockTheme.emotion.colors.bgColor,
    })
    // Matches the st.vega_lite_chart / st.altair_chart download naming:
    // a local `YYYY-MM-DDTHH-MM` timestamp followed by `_chart.png`.
    expect(downloadFilename).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}_chart\.png$/
    )
    clickSpy.mockRestore()
  })

  it("does not override the export background when theme is None", async () => {
    const user = userEvent.setup()
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    render(<Wrapper element={createElement({ theme: "" })} />)

    await user.click(screen.getByRole("button", { name: "Download as PNG" }))

    expect(mockChart.getDataURL).toHaveBeenCalledWith({
      type: "png",
      pixelRatio: 2,
    })
  })

  it.each([
    {
      name: "root",
      spec: {
        backgroundColor: "#fff",
        series: [{ type: "bar", data: [1] }],
      },
    },
    {
      name: "timeline baseOption",
      spec: {
        baseOption: {
          backgroundColor: "#111",
          series: [{ type: "bar", data: [1] }],
        },
        options: [{}],
      },
    },
    {
      name: "media option",
      spec: {
        series: [{ type: "bar", data: [1] }],
        media: [
          { query: { maxWidth: 500 }, option: { backgroundColor: "#222" } },
        ],
      },
    },
    {
      name: "nested baseOption media",
      spec: {
        baseOption: {
          series: [{ type: "bar", data: [1] }],
          media: [
            {
              query: { maxWidth: 500 },
              option: { backgroundColor: "#333" },
            },
          ],
        },
        options: [{}],
      },
    },
    {
      name: "nested timeline options media",
      spec: {
        baseOption: { series: [{ type: "bar", data: [1] }] },
        options: [
          {
            media: [
              {
                query: { maxWidth: 500 },
                option: { backgroundColor: "#444" },
              },
            ],
          },
        ],
      },
    },
  ])(
    "does not override the export background from a $name backgroundColor",
    async ({ spec }) => {
      const user = userEvent.setup()
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
        () => {}
      )

      render(
        <Wrapper element={createElement({ spec: JSON.stringify(spec) })} />
      )

      await user.click(screen.getByRole("button", { name: "Download as PNG" }))

      expect(mockChart.getDataURL).toHaveBeenCalledWith({
        type: "png",
        pixelRatio: 2,
      })
    }
  )

  it("exports an SVG renderer chart with an .svg filename", async () => {
    const user = userEvent.setup()
    mockChart.getDataURL.mockReturnValueOnce("data:image/svg+xml;base64,AAA")
    let downloadFilename: string | null = null
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadFilename = this.download
      })

    render(
      <Wrapper
        element={createElement({ renderer: EChartsChartProto.Renderer.SVG })}
      />
    )

    await user.click(screen.getByRole("button", { name: "Download as SVG" }))

    expect(mockChart.getDataURL).toHaveBeenCalledWith({ type: "svg" })
    expect(downloadFilename).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}_chart\.svg$/
    )
    clickSpy.mockRestore()
  })

  describe("Arrow datasets", () => {
    const SALES_BYTES = tableToIPC(
      new Table({
        product: vectorFromArray(["Matcha", "Latte"], new Utf8()),
        sales: vectorFromArray([43.3, 83.1], new Float64()),
      }),
      "stream"
    )
    const SALES_ROWS = [
      { product: "Matcha", sales: 43.3 },
      { product: "Latte", sales: 83.1 },
    ]
    const COST_BYTES = tableToIPC(
      new Table({ cost: vectorFromArray([1.5, 2.5], new Float64()) }),
      "stream"
    )

    /** A fresh dataset object, as every rerun delivers a new proto. */
    const namedDataset = (
      name: string,
      data: Uint8Array | null
    ): ArrowNamedDataSet.$Properties => ({
      name,
      hasName: true,
      data: { data },
    })

    const datasetSpec = (source: unknown): string =>
      JSON.stringify({
        dataset: { source, dimensions: ["product", "sales"] },
        xAxis: { type: "category" },
        yAxis: {},
        series: [{ type: "bar" }],
      })

    const createDatasetElement = (
      overrides: Partial<EChartsChartProto> = {}
    ): EChartsChartProto =>
      createElement({
        spec: datasetSpec({ name: "h1" }),
        datasets: [namedDataset("h1", SALES_BYTES)],
        ...overrides,
      })

    it("hands setOption the dataset rows instead of the placeholder", () => {
      render(<Wrapper element={createDatasetElement()} />)

      expect(mockChart.setOption).toHaveBeenCalledTimes(1)
      const [appliedOption] = mockChart.setOption.mock.calls[0]
      expect(appliedOption.dataset.source).toEqual(SALES_ROWS)
      expect(appliedOption.dataset.dimensions).toEqual(["product", "sales"])
      expect(
        screen.queryByTestId("stEChartsChartError")
      ).not.toBeInTheDocument()
    })

    it("passes a user-authored name source through unchanged", () => {
      render(
        <Wrapper
          element={createDatasetElement({
            spec: datasetSpec({ name: "Matcha" }),
          })}
        />
      )

      const [appliedOption] = mockChart.setOption.mock.calls[0]
      expect(appliedOption.dataset.source).toEqual({ name: "Matcha" })
      expect(
        screen.queryByTestId("stEChartsChartError")
      ).not.toBeInTheDocument()
    })

    it("skips setOption on a rerun with the same spec and re-applies on a new hash", () => {
      const { rerender } = render(<Wrapper element={createDatasetElement()} />)
      expect(mockChart.setOption).toHaveBeenCalledTimes(1)

      // Same spec, new proto and dataset objects (an unrelated rerun).
      rerender(<Wrapper element={createDatasetElement()} />)
      expect(mockChart.setOption).toHaveBeenCalledTimes(1)

      // New data means a new content hash, so the spec string changes.
      rerender(
        <Wrapper
          element={createDatasetElement({
            spec: datasetSpec({ name: "h2" }),
            datasets: [namedDataset("h2", COST_BYTES)],
          })}
        />
      )
      expect(mockChart.setOption).toHaveBeenCalledTimes(2)
      const [appliedOption] = mockChart.setOption.mock.calls[1]
      expect(appliedOption.dataset.source).toEqual([
        { cost: 1.5 },
        { cost: 2.5 },
      ])
      expect(mockChart.dispose).not.toHaveBeenCalled()
    })

    it.each([
      {
        name: "missing",
        data: null,
        message: "The data for an ECharts dataset.source is missing.",
      },
      {
        name: "corrupt",
        data: new Uint8Array([1, 2, 3]),
        message: "The data for an ECharts dataset.source could not be read",
      },
    ])(
      "shows an error and creates no chart when the dataset bytes are $name",
      ({ data, message }) => {
        render(
          <Wrapper
            element={createDatasetElement({
              datasets: [namedDataset("h1", data)],
            })}
          />
        )

        const error = screen.getByTestId("stEChartsChartError")
        expect(error).toBeVisible()
        expect(error).toHaveTextContent(`ECharts chart error: ${message}`)
        expect(mockInit).not.toHaveBeenCalled()
        expect(mockChart.setOption).not.toHaveBeenCalled()
      }
    )
  })

  describe("inside dataZoom wheel", () => {
    let now = 0
    let nowSpy: ReturnType<typeof vi.spyOn>

    const spec = (
      dataZoom: Record<string, unknown>[],
      extra: Record<string, unknown> = {}
    ): string =>
      JSON.stringify({
        xAxis: {},
        yAxis: {},
        dataZoom,
        series: [{ type: "line", data: [1] }],
        ...extra,
      })

    const renderChart = (
      dataZoom?: Record<string, unknown>[],
      extra: Record<string, unknown> = {}
    ): HTMLElement => {
      render(
        <Wrapper
          element={createElement(
            dataZoom === undefined ? {} : { spec: spec(dataZoom, extra) }
          )}
        />
      )
      return screen.getByTestId("stEChartsChart")
    }

    const dispatchWheel = (
      target: HTMLElement,
      init: WheelEventInit = {}
    ): ReturnType<typeof vi.spyOn> => {
      const event = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 40,
        ...init,
      })
      const stop = vi.spyOn(event, "stopImmediatePropagation")
      target.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
      return stop
    }

    beforeEach(() => {
      now = 10_000
      nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now)
    })

    afterEach(() => {
      nowSpy.mockRestore()
    })

    it("scrolls the page until the pointer has rested, then lets the chart zoom", () => {
      const chart = renderChart([{ type: "inside" }])
      chart.dispatchEvent(new Event("pointerenter"))

      const stopped = dispatchWheel(chart)
      expect(stopped).toHaveBeenCalled()

      now += 16
      const sameFlick = dispatchWheel(chart)
      expect(sameFlick).toHaveBeenCalled()

      now += 500
      const rested = dispatchWheel(chart)
      expect(rested).not.toHaveBeenCalled()
    })

    it("keeps scrolling when a page-scroll flick runs into the chart", () => {
      const chart = renderChart([{ type: "inside" }])

      // A wheel outside the chart, then the chart slides under the cursor.
      window.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: 40,
        })
      )
      now += 20
      chart.dispatchEvent(new Event("pointerenter"))

      const intoChart = dispatchWheel(chart)
      expect(intoChart).toHaveBeenCalled()

      now += 250
      const nextFlick = dispatchWheel(chart)
      expect(nextFlick).toHaveBeenCalled()

      now += 400
      const rested = dispatchWheel(chart)
      expect(rested).not.toHaveBeenCalled()
    })

    it("lets a configured modifier zoom before the pointer has rested", () => {
      const chart = renderChart([
        { type: "inside", zoomOnMouseWheel: "shift" },
      ])
      chart.dispatchEvent(new Event("pointerenter"))

      const unmodified = dispatchWheel(chart)
      expect(unmodified).toHaveBeenCalled()

      // A later flick, before the pointer has rested, with the modifier held.
      now += 250
      const withShift = dispatchWheel(chart, { shiftKey: true })
      expect(withShift).not.toHaveBeenCalled()
    })

    it("keeps the wheel away from ECharts when zoomOnMouseWheel is false", () => {
      const chart = renderChart([{ type: "inside", zoomOnMouseWheel: false }])
      chart.dispatchEvent(new Event("pointerenter"))
      now += 1_000

      const stopped = dispatchWheel(chart)
      expect(stopped).toHaveBeenCalled()
    })

    it("lets a rested wheel reach geo roam when inside zoom ignores it", () => {
      const chart = renderChart(
        [{ type: "inside", zoomOnMouseWheel: false }],
        {
          geo: { roam: true },
        }
      )
      chart.dispatchEvent(new Event("pointerenter"))

      const early = dispatchWheel(chart)
      expect(early).toHaveBeenCalled()

      now += 1_000
      const rested = dispatchWheel(chart)
      expect(rested).not.toHaveBeenCalled()
    })

    it("lets a pinch reach geo roam before the pointer has rested", () => {
      const chart = renderChart(
        [{ type: "inside", zoomOnMouseWheel: false }],
        {
          geo: { roam: true },
        }
      )
      chart.dispatchEvent(new Event("pointerenter"))

      const pinch = dispatchWheel(chart, { ctrlKey: true })
      expect(pinch).not.toHaveBeenCalled()
    })

    it("keeps stopping wheels when roam is drag-only", () => {
      const chart = renderChart(
        [{ type: "inside", zoomOnMouseWheel: false }],
        {
          geo: { roam: "move" },
        }
      )
      chart.dispatchEvent(new Event("pointerenter"))
      now += 1_000

      const stopped = dispatchWheel(chart)
      expect(stopped).toHaveBeenCalled()
    })

    it("does not intercept wheel when the chart has no inside dataZoom", () => {
      const chart = renderChart()
      const stopped = dispatchWheel(chart)
      expect(stopped).not.toHaveBeenCalled()
    })

    it("does not intercept wheel when inside zoom is locked to drag", () => {
      const chart = renderChart([{ type: "inside", zoomLock: true }])
      const stopped = dispatchWheel(chart)
      expect(stopped).not.toHaveBeenCalled()
    })

    it("waits again after the pointer leaves and re-enters", () => {
      const chart = renderChart([{ type: "inside" }])
      chart.dispatchEvent(new Event("pointerenter"))
      now += 1_000
      expect(dispatchWheel(chart)).not.toHaveBeenCalled()

      chart.dispatchEvent(new Event("pointerleave"))
      chart.dispatchEvent(new Event("pointerenter"))
      expect(dispatchWheel(chart)).toHaveBeenCalled()

      now += 1_000
      expect(dispatchWheel(chart)).not.toHaveBeenCalled()
    })

    it("attaches the guard when an inside dataZoom is added", () => {
      const view = render(<Wrapper element={createElement()} />)
      const chart = screen.getByTestId("stEChartsChart")
      expect(dispatchWheel(chart)).not.toHaveBeenCalled()

      view.rerender(
        <Wrapper
          element={createElement({ spec: spec([{ type: "inside" }]) })}
        />
      )
      const next = screen.getByTestId("stEChartsChart")
      next.dispatchEvent(new Event("pointerenter"))
      expect(dispatchWheel(next)).toHaveBeenCalled()
    })

    it("drops the page-wheel clock only after the last guarded chart unmounts", () => {
      const add = vi.spyOn(window, "addEventListener")
      const remove = vi.spyOn(window, "removeEventListener")
      const inside = createElement({ spec: spec([{ type: "inside" }]) })
      const charts = (count: number): ReactElement => (
        <>
          {Array.from({ length: count }, (_, index) => (
            <Wrapper key={index} element={inside} />
          ))}
        </>
      )
      const view = render(charts(2))
      const captureWheels = (spy: typeof add): unknown[][] =>
        spy.mock.calls.filter(
          call =>
            call[0] === "wheel" &&
            (call[2] as { capture?: boolean } | undefined)?.capture === true
        )
      expect(captureWheels(add)).toHaveLength(1)

      view.rerender(charts(1))
      expect(captureWheels(remove)).toHaveLength(0)

      view.unmount()
      expect(captureWheels(remove)).toHaveLength(1)
      add.mockRestore()
      remove.mockRestore()
    })
  })
})
