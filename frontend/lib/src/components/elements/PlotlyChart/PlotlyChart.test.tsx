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

vi.mock("~lib/hooks/useEmotionTheme", () => ({
  useEmotionTheme: () => mockTheme.emotion,
}))

vi.mock("./utils", () => ({
  applyTheming: vi.fn(spec => spec),
  handleSelection: vi.fn(),
  sendEmptySelection: vi.fn(),
}))

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLastPlotProps(): any {
  return MockPlot.mock.calls[MockPlot.mock.calls.length - 1][0]
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <ElementFullscreenContext.Provider value={finalContext as any}>
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockEvent = {} as any

    act(() => {
      lastCallProps.onSelected(mockEvent)
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
      lastCallProps.onDeselect()
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
      lastCallProps.onDoubleClick()
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
    const newFigure = { data: [], layout: { title: "New Title" } }

    act(() => {
      lastCallProps.onUpdate(newFigure)
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

    expect(config.modeBarButtonsToAdd).toBeDefined()
    const fullscreenButton = config.modeBarButtonsToAdd.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) => b.name === "Fullscreen"
    )
    expect(fullscreenButton).toBeDefined()
  })

  it("handles fullscreen button click", () => {
    const expandMock = vi.fn()
    renderComponent({}, { expanded: false, expand: expandMock })

    const lastCallProps = getLastPlotProps()
    const config = lastCallProps.config
    const fullscreenButton = config.modeBarButtonsToAdd.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) => b.name === "Fullscreen"
    )

    act(() => {
      fullscreenButton.click()
    })

    expect(expandMock).toHaveBeenCalled()
  })
})
