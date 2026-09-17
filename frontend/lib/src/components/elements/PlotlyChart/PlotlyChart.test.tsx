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
import type { Figure, PlotParams } from "~lib/util/reactPlotlyCompat"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { PlotlyChart } from "./PlotlyChart"
import {
  applyTheming,
  handleClickEvent,
  handleSelection,
  sendEmptySelection,
} from "./utils"

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

vi.mock("~lib/hooks/useEmotionTheme", () => ({
  useEmotionTheme: () => mockTheme.emotion,
}))

vi.mock("./utils", async importOriginal => {
  const actual = await importOriginal<typeof import("./utils")>()
  return {
    ...actual,
    applyTheming: vi.fn(spec => spec),
    handleSelection: vi.fn(),
    handleClickEvent: vi.fn(),
    sendEmptySelection: vi.fn(),
  }
})

const formClearHelperMocks = vi.hoisted(() => ({
  manageFormClearListener: vi.fn(),
  disconnect: vi.fn(),
}))

// PlotlyChart constructs a new FormClearHelper inside an effect, so the
// shared formClearHelperMocks spies let tests inspect calls across instances.
vi.mock("~lib/components/widgets/Form/FormClearHelper", () => {
  return {
    FormClearHelper: class FormClearHelper {
      public manageFormClearListener(...args: unknown[]): void {
        formClearHelperMocks.manageFormClearListener(...args)
      }
      public disconnect(): void {
        formClearHelperMocks.disconnect()
      }
    },
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
  const lastCall = MockPlot.mock.calls.at(-1)
  if (!lastCall) {
    throw new Error("Expected Plot to have been called")
  }
  return lastCall[0] as PlotParams
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

const CONSTRAINED_SPEC = JSON.stringify({
  data: [
    {
      type: "heatmap",
      z: [
        [1, 2],
        [3, 4],
      ],
    },
  ],
  layout: {
    xaxis: {
      scaleanchor: "y",
      constrain: "domain",
      domain: [0.66, 1],
      range: [-0.5, 1.5],
    },
    yaxis: { constrain: "domain", domain: [0, 0.85], range: [-0.5, 1.5] },
  },
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
    widgetMgr = createWidgetManager()
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

  it("does not let onInitialized replace selection dragmode with Plotly's default zoom", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [PlotlyChartProto.SelectionMode.BOX],
    })
    renderComponent({ element })
    expect(getLastPlotProps().layout.dragmode).toBe("select")

    act(() => {
      getLastPlotProps().onInitialized?.(
        {
          data: getLastPlotProps().data,
          layout: { ...getLastPlotProps().layout, dragmode: "zoom" },
          frames: null,
        },
        document.createElement("div")
      )
    })

    expect(getLastPlotProps().layout.dragmode).toBe("select")
  })

  it("adopts modebar dragmode from onUpdate", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [PlotlyChartProto.SelectionMode.BOX],
    })
    renderComponent({ element })

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data: getLastPlotProps().data,
          layout: { ...getLastPlotProps().layout, dragmode: "pan" },
          frames: null,
        },
        document.createElement("div")
      )
    })

    expect(getLastPlotProps().layout.dragmode).toBe("pan")
  })

  it("adopts modebar dragmode when onUpdate mutates the live layout object", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [PlotlyChartProto.SelectionMode.BOX],
    })
    renderComponent({ element })

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data: getLastPlotProps().data,
          layout: { ...getLastPlotProps().layout, dragmode: "select" },
          frames: null,
        },
        document.createElement("div")
      )
    })

    const liveLayout = getLastPlotProps().layout
    liveLayout.dragmode = "pan"

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data: getLastPlotProps().data,
          layout: liveLayout,
          frames: null,
        },
        document.createElement("div")
      )
    })

    expect(getLastPlotProps().layout.dragmode).toBe("pan")
    // Box-only selection: leaving select/lasso should reset clickmode to none.
    expect(getLastPlotProps().layout.clickmode).toBe("none")
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

  it("saves sanitized figure to widget state on update", () => {
    renderComponent()

    const lastCallProps = getLastPlotProps()
    const newFigure = {
      data: [],
      layout: {
        title: { text: "New Title" },
        xaxis: { range: [2, 8] },
      },
      frames: null,
    }

    act(() => {
      lastCallProps.onUpdate?.(
        newFigure as unknown as Figure,
        document.createElement("div")
      )
    })

    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      DEFAULT_ELEMENT.id,
      "figure",
      expect.objectContaining({
        data: newFigure.data,
        frames: newFigure.frames,
        layout: expect.objectContaining({
          title: "Test Chart",
          xaxis: expect.objectContaining({ range: [2, 8] }),
          width: 600,
          height: 450,
          autosize: false,
        }),
      })
    )
    const storedFigure = vi
      .mocked(widgetMgr.setElementState)
      .mock.calls.at(-1)?.[2]
    expect(storedFigure).not.toBe(newFigure)
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

  it("hides the Plotly Cloud share button by default", () => {
    renderComponent()

    const lastCallProps = getLastPlotProps()
    const config = lastCallProps.config

    expect(config?.showSendToCloud).toBe(false)
    expect(config?.displaylogo).toBe(false)
    expect(config?.modeBarButtonsToRemove).toEqual(
      expect.arrayContaining(["sendChartToCloud", "lasso2d", "select2d"])
    )
  })

  it("respects an explicit showSendToCloud config", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      config: JSON.stringify({ showSendToCloud: true }),
    })
    renderComponent({ element })

    const lastCallProps = getLastPlotProps()
    expect(lastCallProps.config?.showSendToCloud).toBe(true)
    expect(lastCallProps.config?.modeBarButtonsToRemove).not.toContain(
      "sendChartToCloud"
    )
  })

  it("keeps Streamlit toolbar defaults when the user customizes modeBarButtonsToRemove", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      config: JSON.stringify({ modeBarButtonsToRemove: ["zoom"] }),
    })
    renderComponent({ element })

    const lastCallProps = getLastPlotProps()
    expect(lastCallProps.config?.displaylogo).toBe(false)
    expect(lastCallProps.config?.modeBarButtonsToRemove).toEqual([
      "zoom",
      "lasso2d",
      "select2d",
      "sendChartToCloud",
    ])
    expect(lastCallProps.config?.showSendToCloud).toBe(false)
  })

  it("preserves an explicit displaylogo config", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      config: JSON.stringify({ displaylogo: true }),
    })
    renderComponent({ element })

    expect(getLastPlotProps().config?.displaylogo).toBe(true)
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

  it("migrates plotly.js v3 mapbox figures so they render on v4", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      spec: JSON.stringify({
        data: [{ type: "scattermapbox", lon: [0], lat: [51.5] }],
        layout: {
          mapbox: {
            style: "mapbox://styles/mapbox/light-v10",
            accesstoken: "secret",
          },
        },
      }),
      config: JSON.stringify({ mapboxAccessToken: "secret" }),
    })

    renderComponent({ element })

    const lastCallProps = getLastPlotProps()
    expect(lastCallProps.data).toEqual([
      { type: "scattermap", lon: [0], lat: [51.5] },
    ])
    expect(lastCallProps.layout).toEqual(
      expect.objectContaining({
        map: { style: "light" },
      })
    )
    expect(
      (lastCallProps.layout as { mapbox?: unknown }).mapbox
    ).toBeUndefined()
    expect(
      (lastCallProps.config as { mapboxAccessToken?: string } | undefined)
        ?.mapboxAccessToken
    ).toBeUndefined()
  })

  it("hides sharing when the element has no config", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      config: "",
    })
    renderComponent({ element })

    const lastCallProps = getLastPlotProps()
    expect(lastCallProps.config?.showSendToCloud).toBe(false)
    expect(lastCallProps.config?.modeBarButtonsToRemove).toEqual(
      expect.arrayContaining(["sendChartToCloud"])
    )
  })

  it("collapses fullscreen from the plotly toolbar", () => {
    const collapseMock = vi.fn()
    renderComponent({}, { expanded: true, collapse: collapseMock })

    const lastCallProps = getLastPlotProps()
    const config = lastCallProps.config
    const fullscreenButton = config?.modeBarButtonsToAdd?.find(
      b => typeof b === "object" && b.name === "Close fullscreen"
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

    expect(collapseMock).toHaveBeenCalled()
    expect(screen.getByTestId("stPlotlyChartMock")).toBeVisible()
  })

  it("forwards clicks when point selection is enabled", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      selectionMode: [PlotlyChartProto.SelectionMode.POINTS],
    })
    renderComponent({ element })

    const lastCallProps = getLastPlotProps()
    const mockEvent = {} as Readonly<Plotly.PlotMouseEvent>

    act(() => {
      lastCallProps.onClick?.(mockEvent)
    })

    expect(handleClickEvent).toHaveBeenCalledWith(
      mockEvent,
      widgetMgr,
      expect.objectContaining({ id: DEFAULT_ELEMENT.id }),
      undefined
    )
  })

  it("does not attach a click handler when point selection is not enabled", () => {
    renderComponent()

    expect(getLastPlotProps().onClick).toBeUndefined()
    expect(handleClickEvent).not.toHaveBeenCalled()
  })

  it("clears selected points after the reset selection timeout", () => {
    vi.useFakeTimers()
    try {
      const element = new PlotlyChartProto({
        ...DEFAULT_ELEMENT,
        selectionMode: [PlotlyChartProto.SelectionMode.POINTS],
      })
      renderComponent({ element })

      act(() => {
        getLastPlotProps().onDoubleClick?.()
      })

      act(() => {
        vi.advanceTimersByTime(50)
      })

      const figureData = getLastPlotProps().data
      expect(figureData[0]).toEqual(
        expect.objectContaining({ selectedpoints: null })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it("registers a form-clear listener that resets selections", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      formId: "plotly-form",
      selectionMode: [PlotlyChartProto.SelectionMode.POINTS],
    })
    const { unmount } = renderComponent({ element })

    expect(formClearHelperMocks.manageFormClearListener).toHaveBeenCalledWith(
      widgetMgr,
      "plotly-form",
      expect.any(Function)
    )

    const onFormClear = formClearHelperMocks.manageFormClearListener.mock
      .calls[0][2] as () => void
    act(() => {
      onFormClear()
    })

    expect(sendEmptySelection).toHaveBeenCalledWith(
      widgetMgr,
      expect.objectContaining({ id: DEFAULT_ELEMENT.id }),
      undefined
    )

    unmount()
    expect(formClearHelperMocks.disconnect).toHaveBeenCalled()
  })

  it("saves sanitized figure to widget state on initialize", () => {
    renderComponent()

    const figure = {
      data: [],
      layout: {
        title: { text: "Initial" },
        xaxis: { range: [1, 4] as [number, number] },
      },
      frames: null,
    }
    act(() => {
      getLastPlotProps().onInitialized?.(figure, document.createElement("div"))
    })

    expect(widgetMgr.setElementState).toHaveBeenCalledWith(
      DEFAULT_ELEMENT.id,
      "figure",
      expect.objectContaining({
        data: figure.data,
        frames: figure.frames,
        layout: expect.objectContaining({
          title: "Test Chart",
          xaxis: expect.objectContaining({ range: [1, 4] }),
          width: 600,
          height: 450,
          autosize: false,
        }),
      })
    )
    const storedFigure = vi
      .mocked(widgetMgr.setElementState)
      .mock.calls.at(-1)?.[2]
    expect(storedFigure).not.toBe(figure)
  })

  it("keeps Plot layout identity when onUpdate reports only computed domain", () => {
    renderComponent()
    act(() => {
      getLastPlotProps().onInitialized?.(
        {
          data: getLastPlotProps().data,
          layout: getLastPlotProps().layout,
          frames: null,
        },
        document.createElement("div")
      )
    })
    const layoutBefore = getLastPlotProps().layout

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data: getLastPlotProps().data,
          layout: {
            ...layoutBefore,
            xaxis: {
              ...layoutBefore.xaxis,
              domain: [0.67, 0.99],
            },
          },
          frames: null,
        },
        document.createElement("div")
      )
    })

    expect(getLastPlotProps().layout).toBe(layoutBefore)
  })

  it("keeps Plot layout identity when onUpdate reports a new zoom range", () => {
    renderComponent()
    const layoutBefore = getLastPlotProps().layout
    const data = getLastPlotProps().data

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data,
          layout: {
            ...layoutBefore,
            xaxis: { ...layoutBefore.xaxis, range: [2, 8] },
          },
          frames: null,
        },
        document.createElement("div")
      )
    })

    expect(getLastPlotProps().layout).toBe(layoutBefore)
    expect(getLastPlotProps().layout.xaxis?.range).toEqual([2, 8])
  })

  it("does not adopt Plotly-reported domain on constrained axes after onUpdate", () => {
    const element = new PlotlyChartProto({
      ...DEFAULT_ELEMENT,
      spec: CONSTRAINED_SPEC,
    })
    renderComponent({ element })

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data: [
            {
              type: "heatmap",
              z: [
                [1, 2],
                [3, 4],
              ],
            },
          ],
          layout: {
            xaxis: {
              scaleanchor: "y",
              constrain: "domain",
              domain: [0.67, 0.99],
              range: [-0.2, 1.2],
            },
            yaxis: {
              constrain: "domain",
              domain: [0.01, 0.84],
              range: [-0.2, 1.2],
            },
          },
          frames: null,
        },
        document.createElement("div")
      )
    })

    const nextLayout = getLastPlotProps().layout
    expect(nextLayout.xaxis?.domain).toBeUndefined()
    expect(nextLayout.yaxis?.domain).toBeUndefined()
    expect(nextLayout.xaxis?.range).toEqual([-0.2, 1.2])
    expect(nextLayout.xaxis?.scaleanchor).toBe("y")
    expect(nextLayout.xaxis?.constrain).toBe("domain")
    expect(nextLayout.yaxis?.constrain).toBe("domain")
  })

  it("does not adopt Plotly-reported width and height on update", () => {
    renderComponent()

    act(() => {
      getLastPlotProps().onUpdate?.(
        { data: [], layout: { width: 10, height: 10 }, frames: null },
        document.createElement("div")
      )
    })

    const layout = getLastPlotProps().layout
    expect(layout.width).toBe(600)
    expect(layout.height).toBe(450)
    expect(layout.autosize).toBe(false)
  })

  it("does not adopt Plotly-reported automargin on update", () => {
    renderComponent()

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data: [],
          layout: { margin: { l: 99, r: 99, t: 99, b: 99 } },
          frames: null,
        },
        document.createElement("div")
      )
    })

    expect(getLastPlotProps().layout.margin).toBeUndefined()
  })

  it("persists zoom, selection, and camera from onUpdate into Plot props", () => {
    renderComponent()
    const camera = { eye: { x: 1.5, y: 1.5, z: 1.5 } }

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data: [],
          layout: {
            xaxis: { range: [2, 8] },
            selections: [{ type: "rect", x0: 1, x1: 2, y0: 1, y1: 2 }],
            scene: { camera },
            dragmode: "pan",
          },
          frames: null,
        },
        document.createElement("div")
      )
    })

    const layout = getLastPlotProps().layout
    expect(layout.xaxis?.range).toEqual([2, 8])
    expect(layout.selections).toEqual([
      { type: "rect", x0: 1, x1: 2, y0: 1, y1: 2 },
    ])
    expect(layout.scene?.camera).toEqual(camera)
    expect(layout.dragmode).toBe("pan")
  })

  it("persists cartesian zoom reset from onUpdate so a later size change cannot restore range", () => {
    renderComponent()

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data: getLastPlotProps().data,
          layout: {
            ...getLastPlotProps().layout,
            xaxis: { range: [2, 8], autorange: false },
          },
          frames: null,
        },
        document.createElement("div")
      )
    })
    expect(getLastPlotProps().layout.xaxis?.range).toEqual([2, 8])

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data: getLastPlotProps().data,
          layout: {
            ...getLastPlotProps().layout,
            xaxis: { autorange: true },
          },
          frames: null,
        },
        document.createElement("div")
      )
    })

    expect(getLastPlotProps().layout.xaxis?.autorange).toBe(true)
    expect(getLastPlotProps().layout.xaxis?.range).toBeUndefined()
  })

  it("clears persisted selections when onUpdate omits layout.selections", () => {
    renderComponent()

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data: getLastPlotProps().data,
          layout: {
            ...getLastPlotProps().layout,
            selections: [{ type: "rect", x0: 1, x1: 2, y0: 1, y1: 2 }],
          },
          frames: null,
        },
        document.createElement("div")
      )
    })
    expect(getLastPlotProps().layout.selections).toEqual([
      { type: "rect", x0: 1, x1: 2, y0: 1, y1: 2 },
    ])

    const layoutWithoutSelections = { ...getLastPlotProps().layout }
    delete layoutWithoutSelections.selections

    act(() => {
      getLastPlotProps().onUpdate?.(
        {
          data: getLastPlotProps().data,
          layout: layoutWithoutSelections,
          frames: null,
        },
        document.createElement("div")
      )
    })

    expect(getLastPlotProps().layout.selections).toEqual([])
  })

  it("sanitizes recovered widgetMgr figure state on mount", () => {
    const savedFigure = {
      data: [],
      layout: {
        title: "Recovered",
        width: 10,
        height: 10,
        xaxis: {
          scaleanchor: "y",
          constrain: "domain",
          domain: [0.66, 1],
          range: [0, 1],
        },
      },
      frames: null,
    }
    vi.mocked(widgetMgr.getElementState).mockReturnValue(savedFigure)

    renderComponent()

    const layout = getLastPlotProps().layout
    expect(layout.title).toBe("Recovered")
    expect(layout.xaxis?.domain).toBeUndefined()
    expect(layout.xaxis?.scaleanchor).toBe("y")
    expect(layout.xaxis?.range).toEqual([0, 1])
    expect(layout.width).toBe(600)
    expect(layout.height).toBe(450)
    expect(layout.autosize).toBe(false)
  })
})
