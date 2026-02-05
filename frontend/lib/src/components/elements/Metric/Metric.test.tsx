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

import { screen, waitFor } from "@testing-library/react"
import embed from "vega-embed"
import { TopLevelSpec } from "vega-lite"

import {
  LabelVisibility as LabelVisibilityProto,
  Metric as MetricProto,
} from "@streamlit/protobuf"

import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"

import Metric, { getMetricChartSpec, MetricProps } from "./Metric"

// Mock vega-embed
vi.mock("vega-embed", () => ({
  default: vi.fn(),
}))

// Mock useCalculatedDimensions hook
vi.mock("~lib/hooks/useCalculatedDimensions", () => ({
  useCalculatedDimensions: vi.fn(),
}))

const getProps = (elementProps: Partial<MetricProto> = {}): MetricProps => ({
  element: MetricProto.create({
    color: MetricProto.MetricColor.RED,
    direction: MetricProto.MetricDirection.UP,
    delta: "test",
    ...elementProps,
  }),
})

describe("Metric element", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementation for useCalculatedDimensions
    vi.mocked(useCalculatedDimensions).mockReturnValue({
      width: 200,
      height: 100,
      elementRef: { current: null },
    })
  })

  it("renders metric as expected", () => {
    const props = getProps()
    render(<Metric {...props} />)
    const metricElement = screen.getByTestId("stMetric")
    expect(metricElement).toBeVisible()
    expect(metricElement).toHaveClass("stMetric")
  })

  it("renders metric label as expected", () => {
    const props = getProps()
    render(<Metric {...props} />)

    expect(screen.getByTestId("stMetricLabel")).toHaveTextContent(
      props.element.label
    )
  })

  it("pass labelVisibility prop to StyledMetricLabelText correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricLabel")).toHaveAttribute(
      "visibility",
      String(LabelVisibilityProto.LabelVisibilityOptions.HIDDEN)
    )
  })

  it("pass labelVisibility prop to StyledMetricLabelText correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricLabel")).toHaveAttribute(
      "visibility",
      String(LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED)
    )
  })

  it("renders direction icon based on props - red/up", () => {
    const props = getProps()
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricDeltaIcon-Up")).toBeVisible()
  })

  it("renders direction icon based on props - green/down", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GREEN,
      direction: MetricProto.MetricDirection.DOWN,
    })
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricDeltaIcon-Down")).toBeVisible()
  })

  it("renders no text and icon based on props", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GRAY,
      direction: MetricProto.MetricDirection.NONE,
      delta: "",
    })
    render(<Metric {...props} />)
    expect(screen.queryByTestId("stMetricDeltaIcon")).not.toBeInTheDocument()
    expect(screen.queryByTestId("stMetricDelta")).not.toBeInTheDocument()
  })

  it("renders correct gray based on props", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GRAY,
      direction: MetricProto.MetricDirection.NONE,
    })
    render(<Metric {...props} />)
    // This is the gray metric text color
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "color: rgba(49, 51, 63, 0.6);"
    )
    // This is the gray metric background color
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "background-color: rgba(49, 51, 63, 0.1);"
    )
  })

  it("renders correct green based on props", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GREEN,
      direction: MetricProto.MetricDirection.DOWN,
    })
    render(<Metric {...props} />)
    // This is the green metric text color
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "color: rgb(21, 130, 55);"
    )
    // This is the green metric background color
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "background-color: rgba(33, 195, 84, 0.1);"
    )
  })

  it("renders correct red based on props", () => {
    const props = getProps()
    render(<Metric {...props} />)
    // This is the red metric text color
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "color: rgb(189, 64, 67);"
    )
    // This is the red metric background color
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "background-color: rgba(255, 43, 43, 0.1);"
    )
  })

  it("should render TooltipIcon if help text provided", () => {
    const props = getProps({ help: "help text" })
    render(<Metric {...props} />)
    const tooltip = screen.getByTestId("stTooltipIcon")
    expect(tooltip).toBeInTheDocument()
  })

  it("renders without border by default", () => {
    const props = getProps()
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetric")).toHaveStyle("border: none;")
  })

  it("renders with border if passed", () => {
    const props = getProps({ showBorder: true })
    render(<Metric {...props} />)

    const expectedBorder = `${mockTheme.emotion.sizes.borderWidth} solid ${mockTheme.emotion.colors.borderColor}`
    expect(screen.getByTestId("stMetric")).toHaveStyle(
      `border: ${expectedBorder}`
    )
  })

  // Markdown support tests
  describe("Markdown support", () => {
    const markdownCases = [
      {
        name: "bold",
        markdown: "**bold text**",
        expectedText: "bold text",
        expectedElements: ["strong"],
      },
      {
        name: "italic",
        markdown: "*italic text*",
        expectedText: "italic text",
        expectedElements: ["em"],
      },
      {
        name: "inline code",
        markdown: "`code text`",
        expectedText: "code text",
        expectedElements: ["code"],
      },
      {
        name: "combined bold and italic",
        markdown: "***bold italic***",
        expectedText: "bold italic",
        expectedElements: ["strong", "em"],
      },
    ]

    it.each(markdownCases)(
      "renders $name markdown in metric value",
      ({ markdown, expectedText, expectedElements }) => {
        const props = getProps({ body: markdown })
        render(<Metric {...props} />)

        const valueElement = screen.getByTestId("stMetricValue")
        expectedElements.forEach(element => {
          expect(valueElement.querySelector(element)).toBeVisible()
        })
        expect(valueElement).toHaveTextContent(expectedText)
      }
    )

    it.each(markdownCases)(
      "renders $name markdown in delta",
      ({ markdown, expectedText, expectedElements }) => {
        const props = getProps({ delta: markdown })
        render(<Metric {...props} />)

        const deltaElement = screen.getByTestId("stMetricDelta")
        expectedElements.forEach(element => {
          expect(deltaElement.querySelector(element)).toBeVisible()
        })
        expect(deltaElement).toHaveTextContent(expectedText)
      }
    )

    it.each(["body", "delta"] as const)(
      "does not render raw HTML in %s",
      field => {
        const props = getProps({ [field]: "<b>html text</b>" })
        render(<Metric {...props} />)

        const testId = field === "body" ? "stMetricValue" : "stMetricDelta"
        const element = screen.getByTestId(testId)
        // HTML should be escaped, not rendered as bold
        expect(element.querySelector("b")).toBeNull()
        expect(element).toHaveTextContent("<b>html text</b>")
      }
    )
  })

  // Format parameter tests
  describe("Format parameter", () => {
    it("formats value with %.2f format to exact decimal places", () => {
      const props = getProps({ body: "1234.5678", format: "%.2f" })
      render(<Metric {...props} />)

      expect(screen.getByTestId("stMetricValue").textContent).toBe("1234.57")
    })

    it.each([
      { value: "1234567", format: "compact", contains: ["M"] },
      { value: "-1234567", format: "compact", contains: ["-"] },
      { value: "1234.56", format: "dollar", contains: ["$"] },
      { value: "0.5", format: "percent", contains: ["50", "%"] },
    ])(
      "formats value '$value' with format '$format'",
      ({ value, format, contains }) => {
        const props = getProps({ body: value, format })
        render(<Metric {...props} />)

        const valueElement = screen.getByTestId("stMetricValue")
        contains.forEach(text => {
          expect(valueElement.textContent).toContain(text)
        })
      }
    )

    it("formats numeric delta with compact format", () => {
      const props = getProps({ delta: "1000", format: "compact" })
      render(<Metric {...props} />)

      const deltaElement = screen.getByTestId("stMetricDelta")
      expect(deltaElement.textContent).not.toBe("1000")
    })

    it.each([
      { field: "body", value: "70 °F", testId: "stMetricValue" },
      { field: "delta", value: "+5%", testId: "stMetricDelta" },
      { field: "body", value: "—", testId: "stMetricValue" },
      { field: "body", value: "$100", testId: "stMetricValue" },
    ])(
      "does not format non-numeric $field '$value'",
      ({ field, value, testId }) => {
        const props = getProps({ [field]: value, format: "compact" })
        render(<Metric {...props} />)

        expect(screen.getByTestId(testId).textContent).toBe(value)
      }
    )

    it("does not format when format is empty", () => {
      const props = getProps({ body: "1234567", format: "" })
      render(<Metric {...props} />)

      expect(screen.getByTestId("stMetricValue").textContent).toBe("1234567")
    })

    it("falls back to original value when format is invalid", () => {
      // "%d %d" expects two arguments, which will cause formatNumber to throw
      const props = getProps({ body: "1234", delta: "100", format: "%d %d" })
      render(<Metric {...props} />)

      // Should fall back to unformatted values instead of crashing
      expect(screen.getByTestId("stMetricValue").textContent).toBe("1234")
      expect(screen.getByTestId("stMetricDelta").textContent).toBe("100")
    })
  })

  // Chart feature tests
  describe("Chart feature", () => {
    it("renders chart when chartData is provided", () => {
      const props = getProps({
        chartData: [1, 2, 3, 4, 5],
        chartType: MetricProto.ChartType.LINE,
      })
      render(<Metric {...props} />)

      expect(screen.getByTestId("stMetricChart")).toBeVisible()
    })

    it("does not render chart when chartData is empty", () => {
      const props = getProps({
        chartData: [],
        chartType: MetricProto.ChartType.LINE,
      })
      render(<Metric {...props} />)

      expect(screen.queryByTestId("stMetricChart")).not.toBeInTheDocument()
    })

    it("does not render chart when chartData is not provided", () => {
      const props = getProps()
      render(<Metric {...props} />)

      expect(screen.queryByTestId("stMetricChart")).not.toBeInTheDocument()
    })

    it("calls vega-embed when chart data is provided and width is available", async () => {
      const chartData = [1, 2, 3, 4, 5]
      const props = getProps({
        chartData,
        chartType: MetricProto.ChartType.LINE,
      })

      render(<Metric {...props} />)

      await waitFor(() => {
        expect(vi.mocked(embed)).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            data: {
              values: chartData.map((value, index) => ({
                x: index,
                y: value,
              })),
            },
          }),
          expect.objectContaining({
            actions: false,
            renderer: "svg",
            ast: true,
            tooltip: expect.objectContaining({
              theme: "custom",
            }),
          })
        )
      })
    })

    it("does not call vega-embed when width is zero", () => {
      vi.mocked(useCalculatedDimensions).mockReturnValue({
        width: 0,
        height: 100,
        elementRef: { current: null },
      })

      const props = getProps({
        chartData: [1, 2, 3, 4, 5],
        chartType: MetricProto.ChartType.LINE,
      })

      render(<Metric {...props} />)

      expect(vi.mocked(embed)).not.toHaveBeenCalled()
    })

    it("renders chart with different chart types", async () => {
      const chartTypes = [
        MetricProto.ChartType.LINE,
        MetricProto.ChartType.BAR,
        MetricProto.ChartType.AREA,
      ]

      for (const chartType of chartTypes) {
        vi.clearAllMocks()

        const props = getProps({
          chartData: [1, 2, 3, 4, 5],
          chartType,
        })

        render(<Metric {...props} />)

        await waitFor(() => {
          expect(vi.mocked(embed)).toHaveBeenCalled()
        })
      }
    })

    it("handles single value chartData by duplicating the value", async () => {
      const props = getProps({
        chartData: [42],
        chartType: MetricProto.ChartType.LINE,
      })

      render(<Metric {...props} />)

      await waitFor(() => {
        expect(vi.mocked(embed)).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            data: {
              values: [
                { x: 0, y: 42 },
                { x: 1, y: 42 },
              ],
            },
          }),
          expect.any(Object)
        )
      })
    })

    it("formats the tooltip correctly", async () => {
      const chartData = [10.123, 20.456, 30.789]
      const props = getProps({
        chartData,
        chartType: MetricProto.ChartType.LINE,
      })

      render(<Metric {...props} />)

      await waitFor(() => {
        expect(vi.mocked(embed)).toHaveBeenCalled()
      })

      const embedCall = vi.mocked(embed).mock.calls[0]
      const tooltipOptions = embedCall[2]?.tooltip as {
        formatTooltip: (value: { y: number }) => string
      }

      expect(tooltipOptions).toBeDefined()
      expect(tooltipOptions.formatTooltip({ y: 12.345 })).toBe("12.345")
      expect(tooltipOptions.formatTooltip({ y: 42 })).toBe("42")
    })
  })

  describe("getMetricChartSpec function", () => {
    it("generates correct spec for line chart", () => {
      const chartData = [1, 2, 3, 4, 5]
      const spec = getMetricChartSpec(
        chartData,
        MetricProto.ChartType.LINE,
        200,
        mockTheme.emotion,
        MetricProto.MetricColor.RED
      )

      expect(spec).toMatchObject({
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: 200,
        data: {
          values: chartData.map((value, index) => ({ x: index, y: value })),
        },
        layer: expect.arrayContaining([
          expect.objectContaining({
            mark: expect.objectContaining({
              type: "line",
              strokeCap: "round",
              strokeWidth: mockTheme.emotion.sizes.metricStrokeWidth,
            }),
          }),
        ]),
      })
    })

    it("generates correct spec for bar chart", () => {
      const chartData = [1, 2, 3, 4, 5]
      const spec = getMetricChartSpec(
        chartData,
        MetricProto.ChartType.BAR,
        200,
        mockTheme.emotion,
        MetricProto.MetricColor.GREEN
      )

      expect(spec).toMatchObject({
        layer: expect.arrayContaining([
          expect.objectContaining({
            mark: expect.objectContaining({
              type: "bar",
              cornerRadius: 9999,
            }),
          }),
        ]),
        config: expect.objectContaining({
          padding: { left: 0, right: 0, top: 2, bottom: 2 },
        }),
      })
    })

    it("generates correct spec for area chart", () => {
      const chartData = [1, 2, 3, 4, 5]
      const spec = getMetricChartSpec(
        chartData,
        MetricProto.ChartType.AREA,
        200,
        mockTheme.emotion,
        MetricProto.MetricColor.GRAY
      )

      expect(spec).toMatchObject({
        layer: expect.arrayContaining([
          expect.objectContaining({
            mark: expect.objectContaining({
              type: "area",
              opacity: 1,
              line: expect.objectContaining({
                strokeWidth: mockTheme.emotion.sizes.metricStrokeWidth,
                strokeCap: "round",
              }),
            }),
          }),
        ]),
      })
    })

    it("handles single value by duplicating it", () => {
      const chartData = [42]
      const spec = getMetricChartSpec(
        chartData,
        MetricProto.ChartType.LINE,
        200,
        mockTheme.emotion,
        MetricProto.MetricColor.RED
      )

      const data = spec.data as { values: { x: number; y: number }[] }
      expect(data?.values).toEqual([
        { x: 0, y: 42 },
        { x: 1, y: 42 },
      ])
    })

    it("sets correct width and height", () => {
      const spec = getMetricChartSpec(
        [1, 2, 3],
        MetricProto.ChartType.LINE,
        150,
        mockTheme.emotion,
        MetricProto.MetricColor.RED
      ) as TopLevelSpec & { width: number; height: number }

      expect(spec.width).toBe(150)
      expect(typeof spec.height).toBe("number")
      expect(spec.height).toBeGreaterThan(0)
    })

    it("includes interactive hover selection", () => {
      const spec = getMetricChartSpec(
        [1, 2, 3],
        MetricProto.ChartType.LINE,
        200,
        mockTheme.emotion,
        MetricProto.MetricColor.RED
      ) as TopLevelSpec & { layer: unknown[] }

      // Check for hover selection parameter
      const pointsLayer = spec.layer?.[1] as { params?: unknown[] }
      expect(pointsLayer?.params).toBeDefined()
      expect(pointsLayer?.params?.[0]).toMatchObject({
        select: expect.objectContaining({
          type: "point",
          encodings: ["x"],
          nearest: true,
          on: "mousemove",
          clear: "mouseleave",
        }),
      })
    })

    it("throttles hover selection for large datasets", () => {
      const largeChartData = Array.from({ length: 1500 }, (_, index) =>
        Number(index)
      )
      const spec = getMetricChartSpec(
        largeChartData,
        MetricProto.ChartType.LINE,
        200,
        mockTheme.emotion,
        MetricProto.MetricColor.RED
      ) as TopLevelSpec & { layer: unknown[] }

      const pointsLayer = spec.layer?.[1] as { params?: unknown[] }
      expect(pointsLayer?.params?.[0]).toMatchObject({
        select: expect.objectContaining({
          on: "mousemove{16}",
        }),
      })
    })

    it("includes highlighted points layer", () => {
      const spec = getMetricChartSpec(
        [1, 2, 3],
        MetricProto.ChartType.LINE,
        200,
        mockTheme.emotion,
        MetricProto.MetricColor.RED
      ) as TopLevelSpec & { layer: unknown[] }

      // Check for highlighted points layer
      const highlightedPointsLayer = spec.layer?.[2] as { mark?: unknown }
      expect(highlightedPointsLayer?.mark).toMatchObject({
        type: "point",
        filled: true,
        size: 65,
        tooltip: true,
      })
    })
  })
})
