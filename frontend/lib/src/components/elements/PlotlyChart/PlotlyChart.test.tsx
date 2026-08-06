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

import { act, render, screen } from "@testing-library/react"

import { PlotlyChart as PlotlyChartProto } from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import { mockTheme } from "~lib/mocks/mockTheme"
import type { PlotParams } from "~lib/util/reactPlotlyCompat"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { PlotlyChart } from "./PlotlyChart"
import { applyTheming, handleSelection, sendEmptySelection } from "./utils"

// Mock Plotly component to capture props
const MockPlot = vi.fn((_props: unknown) => (
  <div data-testid="stPlotlyChartMock" />
))

vi.mock("react-plotly.js", () => ({
  default: (props: unknown) => MockPlot(props),
}))

// Mock dependencies
vi.mock("~lib/hooks/useCalculatedDimensions", () => ({
  useCalculatedDimensions: () => ({
    height: 450,
    elementRef: { current: null },
  }),
}))

// Mutable holder so individual tests can simulate a theme change (e.g. a
// light<->dark toggle) by swapping the value returned by useEmotionTheme.
const themeHolder = vi.hoisted<{ current: unknown }>(() => ({ current: null }))

vi.mock("~lib/hooks/useEmotionTheme", () => ({
  useEmotionTheme: () => themeHolder.current,
}))

vi.mock("./utils", async importOriginal => {
  const actual = await importOriginal<typeof import("./utils")>()
  return {
    ...actual,
    applyTheming: vi.fn(spec => spec),
    handleSelection: vi.fn(),
    sendEmptySelection: vi.fn(),
  }
})

vi.mock("~lib/components/widgets/Form/FormClearHelper", () => {
  return {
    FormClearHelper: vi.fn().mockImplementation(() => ({
      manageFormClearListener: vi.fn(),
      disconnect: vi.fn(),
    })),
  }
})

const createWidgetManager = (): WidgetStateManager => {
  const mgr = new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })
  mgr.getElementState = vi.fn()
  mgr.setElementState = vi.fn()
  return mgr
}

function getLastPlotProps(): PlotParams {
  return MockPlot.mock.calls[MockPlot.mock.calls.length - 1][0] as PlotParams
}

// Static test data - extracted to module level per coding guidelines
const DEFAULT_ELEMENT = new PlotlyChartProto({
  spec: JSON.stringify({
    data: [{ type: "scatter", x: [1, 2], y: [1, 2] }],
    layout: { title: "Test Chart" },
  }),
  config: JSON.stringify({}),
  selectionMode: [],
  id: "test_chart_id",
  theme: "streamlit",
})

describe("PlotlyChart Component", () => {
  // Create fresh widgetMgr for each test to avoid shared state
  let widgetMgr: WidgetStateManager

  const renderComponent = (
    props: Partial<React.ComponentProps<typeof PlotlyChart>> = {},
    contextValue: Record<string, unknown> = {}
  ): ReturnType<typeof render> => {
    const finalContext = {
      expanded: false,
      width: 600,
      height: 500,
      expand: vi.fn(),
      collapse: vi.fn(),
      ...contextValue,
    }

    return render(
      <ElementFullscreenContext.Provider
        value={
          finalContext as React.ComponentProps<
            typeof ElementFullscreenContext.Provider
          >["value"]
        }
      >
        <PlotlyChart
          element={DEFAULT_ELEMENT}
          widgetMgr={widgetMgr}
          disabled={false}
          width={600}
          {...props}
        />
      </ElementFullscreenContext.Provider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(applyTheming).mockImplementation(spec => spec)
    widgetMgr = createWidgetManager()
    themeHolder.current = mockTheme.emotion
  })

  it("renders without crashing", () => {
    renderComponent()
    expect(screen.getByTestId("stPlotlyChart")).toBeVisible()
    expect(MockPlot).toHaveBeenCalled()
  })

  it("initializes figure state correctly", () => {
    renderComponent()
    expect(applyTheming).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({ title: "Test Chart" }),
      }),
      "streamlit",
      expect.anything()
    )
  })

  it("recovers state from widgetMgr if available", () => {
    const savedFigure = { data: [], layout: { title: "Recovered" } }
    vi.mocked(widgetMgr.getElementState).mockReturnValue(savedFigure)

    renderComponent()

    const lastCallProps = getLastPlotProps()
    expect(lastCallProps.layout.title).toBe("Recovered")
  })

  it("re-themes from the original spec when the theme changes", () => {
    const buildTree = (): React.ReactElement => (
      <ElementFullscreenContext.Provider
        value={{
          expanded: false,
          width: 600,
          height: 500,
          expand: vi.fn(),
          collapse: vi.fn(),
        }}
      >
        <PlotlyChart
          element={DEFAULT_ELEMENT}
          widgetMgr={widgetMgr}
          disabled={false}
          width={600}
        />
      </ElementFullscreenContext.Provider>
    )

    const { rerender } = render(buildTree())
    // Ignore the initial theming from the useState initializer; we only care
    // about what happens on the subsequent theme change.
    vi.mocked(applyTheming).mockClear()

    // Simulate a theme change (e.g. light -> dark) and re-render.
    const newTheme = { ...mockTheme.emotion }
    themeHolder.current = newTheme
    act(() => {
      rerender(buildTree())
    })

    // The figure must be re-themed from the pristine spec (which still holds
    // the categorical/sequential/diverging palette placeholders) using the new
    // theme - not from the already-themed figure, whose placeholders were
    // consumed on the previous render.
    expect(applyTheming).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({ title: "Test Chart" }),
      }),
      "streamlit",
      newTheme
    )

    // The pristine spec has no runtime dimensions baked into its layout, which
    // confirms we re-themed the original spec rather than the current figure.
    const rethemeCall = vi
      .mocked(applyTheming)
      .mock.calls.find(call => call[2] === newTheme)
    expect(
      (rethemeCall?.[0] as { layout?: { width?: number } })?.layout?.width
    ).toBeUndefined()
  })

  it("preserves selection modes and axis ranges across theme changes", () => {
    const selectableElement = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [
        PlotlyChartProto.SelectionMode.POINTS,
        PlotlyChartProto.SelectionMode.BOX,
      ],
    })

    // Seed recovered figure state with interactive fields that would otherwise
    // be wiped by re-theming from the pristine spec.
    const interactiveFigure = {
      data: [{ type: "scatter", x: [1, 2], y: [1, 2], selectedpoints: [1] }],
      layout: {
        title: "Recovered",
        width: 600,
        height: 450,
        clickmode: "event+select",
        hovermode: "closest",
        dragmode: "pan",
        xaxis: { range: [0, 10], autorange: false, gridcolor: "#old" },
        yaxis: { range: [0, 20], gridcolor: "#old" },
      },
    }
    vi.mocked(widgetMgr.getElementState).mockReturnValue(interactiveFigure)

    // applyTheming is mocked as identity-ish, so re-theme returns the pristine
    // spec plus fresh themed axis styling. preserveFigureInteractionState must
    // carry interactive fields back from the previous figure.
    vi.mocked(applyTheming).mockImplementation(spec => {
      const figure = spec as {
        data: unknown[]
        layout?: Record<string, unknown>
        frames?: unknown
      }
      return {
        ...figure,
        layout: {
          ...figure.layout,
          xaxis: { gridcolor: "#new" },
          yaxis: { gridcolor: "#new" },
        },
      } as typeof spec
    })

    const buildTree = (): React.ReactElement => (
      <ElementFullscreenContext.Provider
        value={{
          expanded: false,
          width: 600,
          height: 500,
          expand: vi.fn(),
          collapse: vi.fn(),
        }}
      >
        <PlotlyChart
          element={selectableElement}
          widgetMgr={widgetMgr}
          disabled={false}
          width={600}
        />
      </ElementFullscreenContext.Provider>
    )

    const { rerender } = render(buildTree())

    const newTheme = { ...mockTheme.emotion }
    themeHolder.current = newTheme
    act(() => {
      rerender(buildTree())
    })

    const lastCallProps = getLastPlotProps()
    expect(lastCallProps.layout.clickmode).toBe("event+select")
    expect(lastCallProps.layout.hovermode).toBe("closest")
    expect(lastCallProps.layout.dragmode).toBe("pan")
    expect(lastCallProps.layout.xaxis?.range).toEqual([0, 10])
    expect(lastCallProps.layout.yaxis?.range).toEqual([0, 20])
    // Themed styling comes from the rethemed figure, not the previous theme.
    expect(lastCallProps.layout.xaxis?.gridcolor).toBe("#new")
    expect(lastCallProps.layout.yaxis?.gridcolor).toBe("#new")
    expect(lastCallProps.data[0]).toEqual(
      expect.objectContaining({ selectedpoints: [1] })
    )
  })

  it("updates dimensions based on context", () => {
    renderComponent({}, { width: 800 })

    const lastCallProps = getLastPlotProps()

    expect(lastCallProps.layout.width).toBe(800)
    expect(lastCallProps.layout.height).toBe(450)
  })

  it("handles fullscreen mode dimensions", () => {
    renderComponent({}, { expanded: true, height: 900, width: 1000 })

    const lastCallProps = getLastPlotProps()

    expect(lastCallProps.layout.width).toBe(1000)
    expect(lastCallProps.layout.height).toBe(900)
  })

  it("configures selection modes correctly (Points)", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [PlotlyChartProto.SelectionMode.POINTS],
    })

    renderComponent({ element })

    const lastCallProps = getLastPlotProps()

    // Points selection -> clickmode: "event+select", dragmode: "pan"
    expect(lastCallProps.layout.clickmode).toBe("event+select")
    expect(lastCallProps.layout.dragmode).toBe("pan")
  })

  it("configures selection modes correctly (Box)", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [PlotlyChartProto.SelectionMode.BOX],
    })

    renderComponent({ element })

    const lastCallProps = getLastPlotProps()

    // Box selection -> dragmode: "select"
    expect(lastCallProps.layout.dragmode).toBe("select")
    // clickmode is set to "event" via effect when dragmode is select/lasso
    expect(lastCallProps.layout.clickmode).toBe("event")
  })

  it("configures selection modes correctly (Lasso)", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [PlotlyChartProto.SelectionMode.LASSO],
    })

    renderComponent({ element })

    const lastCallProps = getLastPlotProps()

    // Lasso selection -> dragmode: "lasso"
    expect(lastCallProps.layout.dragmode).toBe("lasso")
    // clickmode is set to "event" via effect when dragmode is select/lasso
    expect(lastCallProps.layout.clickmode).toBe("event")
  })

  it("disables interactions when disabled prop is true", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [PlotlyChartProto.SelectionMode.POINTS],
    })

    renderComponent({ element, disabled: true })

    const lastCallProps = getLastPlotProps()

    // When disabled, clickmode should be "none" and dragmode should be "pan"
    expect(lastCallProps.layout.clickmode).toBe("none")
    expect(lastCallProps.layout.dragmode).toBe("pan")
  })

  it("handles empty spec gracefully", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      spec: "",
    })

    renderComponent({ element })

    const lastCallProps = getLastPlotProps()

    expect(lastCallProps.data).toEqual([])
    expect(lastCallProps.layout).toBeDefined()
  })

  it("calls handleSelection on selection event", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [PlotlyChartProto.SelectionMode.POINTS],
    })

    renderComponent({ element })

    const lastCallProps = getLastPlotProps()
    const mockEvent = {} as Readonly<Plotly.PlotSelectionEvent>

    act(() => {
      lastCallProps.onSelected?.(mockEvent)
    })

    expect(handleSelection).toHaveBeenCalledWith(
      mockEvent,
      widgetMgr,
      expect.objectContaining({ id: DEFAULT_ELEMENT.id }),
      undefined
    )
  })

  it("calls sendEmptySelection on deselect event", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [PlotlyChartProto.SelectionMode.POINTS],
    })

    renderComponent({ element })

    const lastCallProps = getLastPlotProps()

    act(() => {
      lastCallProps.onDeselect?.()
    })

    // It should call sendEmptySelection
    // And it also calls resetSelectionsCallback(false) inside component
    expect(sendEmptySelection).toHaveBeenCalledWith(
      widgetMgr,
      expect.objectContaining({ id: DEFAULT_ELEMENT.id }),
      undefined
    )
  })

  it("resets selections on double-click when selection is activated", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [PlotlyChartProto.SelectionMode.POINTS],
    })

    renderComponent({ element })

    const lastCallProps = getLastPlotProps()

    // onDoubleClick should be defined when selection is activated
    expect(lastCallProps.onDoubleClick).toBeDefined()

    act(() => {
      lastCallProps.onDoubleClick?.()
    })

    // Double-click should reset selections by calling sendEmptySelection
    expect(sendEmptySelection).toHaveBeenCalledWith(
      widgetMgr,
      expect.objectContaining({ id: DEFAULT_ELEMENT.id }),
      undefined
    )
  })

  it("does not have double-click handler when selection is not activated", () => {
    // No selection mode means selection is not activated
    renderComponent()

    const lastCallProps = getLastPlotProps()

    // onDoubleClick should be undefined when selection is not activated
    expect(lastCallProps.onDoubleClick).toBeUndefined()
  })

  it("saves figure to widget state on update", () => {
    renderComponent()

    const lastCallProps = getLastPlotProps()
    const newFigure = {
      data: [],
      layout: { title: { text: "New Title" } },
      frames: null,
    }

    act(() => {
      lastCallProps.onUpdate?.(newFigure, document.createElement("div"))
    })

    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      DEFAULT_ELEMENT.id,
      "figure",
      newFigure
    )
  })

  it("adds fullscreen button to toolbar", () => {
    renderComponent()

    const lastCallProps = getLastPlotProps()
    const config = lastCallProps.config

    expect(config?.modeBarButtonsToAdd).toBeDefined()
    const fullscreenButton = config?.modeBarButtonsToAdd?.find(
      b => typeof b === "object" && b.name === "Fullscreen"
    )
    expect(fullscreenButton).toBeDefined()
  })

  it("handles fullscreen button click", () => {
    const expandMock = vi.fn()
    renderComponent({}, { expanded: false, expand: expandMock })

    const lastCallProps = getLastPlotProps()
    const config = lastCallProps.config
    const fullscreenButton = config?.modeBarButtonsToAdd?.find(
      b => typeof b === "object" && b.name === "Fullscreen"
    )

    act(() => {
      if (typeof fullscreenButton === "object") {
        fullscreenButton.click(
          document.createElement("div") as unknown as Parameters<
            typeof fullscreenButton.click
          >[0],
          new MouseEvent("click")
        )
      }
    })

    expect(expandMock).toHaveBeenCalled()
  })

  it("does not preserve interaction state when element id changes", () => {
    const firstElement = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      id: "chart_A",
      spec: JSON.stringify({
        data: [{ type: "scatter", x: [1, 2], y: [1, 2] }],
        layout: { title: "Chart A" },
      }),
    })

    const secondElement = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      id: "chart_B",
      spec: JSON.stringify({
        data: [{ type: "bar", x: [3, 4], y: [3, 4] }],
        layout: { title: "Chart B" },
      }),
    })

    const buildTree = (element: PlotlyChartProto): React.ReactElement => (
      <ElementFullscreenContext.Provider
        value={{
          expanded: false,
          width: 600,
          height: 500,
          expand: vi.fn(),
          collapse: vi.fn(),
        }}
      >
        <PlotlyChart
          element={element}
          widgetMgr={widgetMgr}
          disabled={false}
          width={600}
        />
      </ElementFullscreenContext.Provider>
    )

    const { rerender } = render(buildTree(firstElement))

    vi.mocked(applyTheming).mockClear()

    act(() => {
      rerender(buildTree(secondElement))
    })

    // applyTheming should be called with the new element's pristine spec
    expect(applyTheming).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({ title: "Chart B" }),
      }),
      "streamlit",
      expect.anything()
    )

    const lastCallProps = getLastPlotProps()
    // The new chart should not carry over interactive state from the old one
    expect(lastCallProps.layout.clickmode).toBeUndefined()
    expect(lastCallProps.layout.dragmode).toBeUndefined()
    expect(lastCallProps.layout.xaxis?.range).toBeUndefined()
  })

  it("onUpdate does not revert theme when Plotly fires with the rethemed figure", () => {
    const buildTree = (): React.ReactElement => (
      <ElementFullscreenContext.Provider
        value={{
          expanded: false,
          width: 600,
          height: 500,
          expand: vi.fn(),
          collapse: vi.fn(),
        }}
      >
        <PlotlyChart
          element={DEFAULT_ELEMENT}
          widgetMgr={widgetMgr}
          disabled={false}
          width={600}
        />
      </ElementFullscreenContext.Provider>
    )

    const { rerender } = render(buildTree())

    // Simulate a theme change that produces visibly different output.
    vi.mocked(applyTheming).mockImplementation(spec => {
      const figure = spec as {
        data: unknown[]
        layout?: Record<string, unknown>
        frames?: unknown
      }
      return {
        ...figure,
        layout: {
          ...figure.layout,
          paper_bgcolor: "#new_theme_bg",
        },
      } as typeof spec
    })

    const newTheme = { ...mockTheme.emotion }
    themeHolder.current = newTheme
    act(() => {
      rerender(buildTree())
    })

    // Verify theme was applied
    let lastCallProps = getLastPlotProps()
    expect(lastCallProps.layout.paper_bgcolor).toBe("#new_theme_bg")

    // Simulate Plotly's onUpdate firing with the correctly themed figure
    // (this is what happens after Plotly processes the new props).
    const themedFigure = {
      data: lastCallProps.data,
      layout: { ...lastCallProps.layout, paper_bgcolor: "#new_theme_bg" },
      frames: null,
    }

    act(() => {
      lastCallProps.onUpdate?.(themedFigure, document.createElement("div"))
    })

    lastCallProps = getLastPlotProps()
    // The theme colors should persist after onUpdate
    expect(lastCallProps.layout.paper_bgcolor).toBe("#new_theme_bg")
  })
})
