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

import { ReactElement, useMemo } from "react"

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { EChartsChart as EChartsChartProto } from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { EChartsChart } from "./EChartsChart"

const { mockInit, mockChart } = vi.hoisted(() => {
  const mockChart = {
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    getDataURL: vi.fn(() => "data:image/png;base64,AAA"),
    on: vi.fn(),
    off: vi.fn(),
    dispatchAction: vi.fn(),
    convertFromPixel: vi.fn(),
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

vi.mock("echarts", () => ({
  init: mockInit,
}))

vi.mock("~lib/hooks/useCalculatedDimensions", () => ({
  useCalculatedDimensions: () => ({
    width: 600,
    height: 400,
    elementRef: mockContainerRef,
  }),
}))

vi.mock("~lib/hooks/useEmotionTheme", () => ({
  useEmotionTheme: () => mockTheme.emotion,
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
    selectionMode: [],
    formId: "",
    ...overrides,
  })
}

describe("EChartsChart", () => {
  let widgetMgr: WidgetStateManager

  const Wrapper = ({
    element,
    isFullScreen = false,
  }: {
    element: EChartsChartProto
    isFullScreen?: boolean
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
          disabled={false}
        />
      </ElementFullscreenContext.Provider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockContainerRef.current = null
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
    // The resize that coincides with init is skipped (echarts sizes at init),
    // avoiding a benign "resize during main process" warning.
    expect(mockChart.resize).not.toHaveBeenCalled()
    expect(screen.getByTestId("stEChartsChart")).toBeVisible()
  })

  it("renders display-only charts (empty id) without binding selection handlers", () => {
    render(<Wrapper element={createElement({ id: "", selectionMode: [] })} />)

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
    // With theme=None the option is left untouched (no aria default).
    const [appliedOption] = mockChart.setOption.mock.calls[0]
    expect(appliedOption.aria).toBeUndefined()
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

  it("exports the chart as a PNG via the download toolbar action", async () => {
    const user = userEvent.setup()
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    render(<Wrapper element={createElement()} />)

    await user.click(screen.getByRole("button", { name: "Download as PNG" }))

    expect(mockChart.getDataURL).toHaveBeenCalledWith({
      pixelRatio: 2,
      backgroundColor: mockTheme.emotion.colors.bgColor,
    })
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })
})
