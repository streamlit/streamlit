/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React from "react"

import { screen, waitFor } from "@testing-library/react"
import embed from "vega-embed"
import { TopLevelSpec } from "vega-lite"

import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  Metric as MetricProto,
} from "@streamlit/protobuf"

import { useCalculatedWidth } from "~lib/hooks/useCalculatedWidth"
import { mockTheme } from "~lib/mocks/mockTheme"
import { render } from "~lib/test_util"

import Metric, { getMetricChartSpec, MetricProps } from "./Metric"

// Mock vega-embed
vi.mock("vega-embed", () => ({
  default: vi.fn(),
}))

// Mock useCalculatedWidth hook
vi.mock("~lib/hooks/useCalculatedWidth", () => ({
  useCalculatedWidth: vi.fn(),
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
    // Default mock implementation for useCalculatedWidth
    vi.mocked(useCalculatedWidth).mockReturnValue([200, { current: null }])
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
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricLabel")).toHaveAttribute(
      "visibility",
      String(LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN)
    )
  })

  it("pass labelVisibility prop to StyledMetricLabelText correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricLabel")).toHaveAttribute(
      "visibility",
      String(LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED)
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
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "color: rgba(49, 51, 63, 0.6);"
    )
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "background-color: rgba(128, 132, 149, 0.1);"
    )
  })

  it("renders correct green based on props", () => {
    const props = getProps({
      color: MetricProto.MetricColor.GREEN,
      direction: MetricProto.MetricDirection.DOWN,
    })
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "color: rgb(21, 130, 55);"
    )
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "background-color: rgba(33, 195, 84, 0.1);"
    )
  })

  it("renders correct red based on props", () => {
    const props = getProps()
    render(<Metric {...props} />)
    expect(screen.getByTestId("stMetricDelta")).toHaveStyle(
      "color: rgb(255, 43, 43);"
    )
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
      vi.mocked(useCalculatedWidth).mockReturnValue([0, { current: null }])

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
      const tooltipOptions = embedCall[2]?.tooltip as
        | { formatTooltip: (value: { y: number }) => string }
        | undefined

      expect(tooltipOptions).toBeDefined()
      if (tooltipOptions) {
        expect(tooltipOptions.formatTooltip({ y: 12.345 })).toBe("12.345")
        expect(tooltipOptions.formatTooltip({ y: 42 })).toBe("42")
      }
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
              strokeWidth: 2,
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
              opacity: 0.2,
              line: expect.objectContaining({
                strokeWidth: 2,
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
          clear: "mouseout",
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
