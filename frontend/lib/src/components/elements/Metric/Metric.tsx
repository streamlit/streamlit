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

import React, { memo, ReactElement, useEffect, useRef } from "react"

import { EmotionIcon } from "@emotion-icons/emotion-icon"
import { ArrowDownward, ArrowUpward } from "@emotion-icons/material-outlined"
import { expressionInterpreter } from "vega-interpreter"
import embed from "vega-embed"
import { Global } from "@emotion/react"
import { TopLevelSpec } from "vega-lite"

import { Metric as MetricProto } from "@streamlit/protobuf"
import { convertRemToPx, EmotionTheme, useEmotionTheme } from "@streamlit/lib"

import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import Icon from "~lib/components/shared/Icon"
import { StyledWidgetLabelHelpInline } from "~lib/components/widgets/BaseWidget"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import { Placement } from "~lib/components/shared/Tooltip"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import { useCalculatedWidth } from "~lib/hooks/useCalculatedWidth"
import {
  applyStreamlitTheme,
  StyledVegaLiteChartTooltips,
} from "~lib/components/elements/ArrowVegaLiteChart"

import {
  getMetricColor,
  StyledMetricChart,
  StyledMetricContainer,
  StyledMetricContent,
  StyledMetricDeltaText,
  StyledMetricLabelText,
  StyledMetricValueText,
  StyledTruncateText,
} from "./styled-components"

export interface MetricProps {
  element: MetricProto
}

export function getMetricChartSpec(
  chartData: number[],
  chartType: MetricProto.ChartType,
  availableWidth: number,
  theme: EmotionTheme,
  metricColor: MetricProto.MetricColor
): TopLevelSpec {
  const randomId = Math.random().toString(36).slice(2, 10)
  const baseName = `metric_chart_${randomId}`

  // Special handling for single value - duplicate it since line / area
  // charts need at least two points:
  const data =
    chartData.length === 1 ? [chartData[0], chartData[0]] : chartData

  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: Math.round(availableWidth),
    height: Math.round(convertRemToPx("3.5rem")),
    data: {
      values: data.map((value, index) => ({ x: index, y: value })),
    },
    layer: [
      {
        name: `${baseName}_mark`,
        mark: {
          type: "line",
          ...(chartType === MetricProto.ChartType.LINE && {
            type: "line",
            strokeCap: "round",
            strokeWidth: 2,
          }),
          ...(chartType === MetricProto.ChartType.BAR && {
            type: "bar",
            cornerRadius: parseFloat(theme.radii.full),
          }),
          ...(chartType === MetricProto.ChartType.AREA && {
            type: "area",
            opacity: 0.2,
            line: {
              color: getMetricColor(theme, metricColor),
              strokeWidth: 2,
              strokeCap: "round",
            },
          }),
        },
        encoding: {
          x: {
            field: "x",
            type: "quantitative",
            axis: null,
            scale: {
              zero: false,
              nice: false,
            },
          },
          y: {
            field: "y",
            type: "quantitative",
            axis: null,
            scale: {
              zero: false,
              nice: false,
            },
          },
        },
      },
      {
        name: `${baseName}_points`,
        mark: {
          type: "point",
          opacity: 0,
        },
        encoding: {
          x: {
            field: "x",
            type: "quantitative",
            axis: null,
            scale: {
              zero: false,
              nice: false,
            },
          },
          y: {
            field: "y",
            type: "quantitative",
            axis: null,
            scale: {
              zero: false,
              nice: false,
            },
          },
        },
        params: [
          {
            name: `${baseName}_hover_selection`,
            select: {
              type: "point",
              encodings: ["x"],
              nearest: true,
              on: "mousemove",
              clear: "mouseout",
            },
          },
        ],
      },
      {
        name: `${baseName}_highlighted_points`,
        transform: [
          {
            filter: {
              param: `${baseName}_hover_selection`,
              empty: false,
            },
          },
          {
            window: [
              {
                op: "row_number",
                as: "hover_selection_rank",
              },
            ],
          },
          {
            filter: "datum.hover_selection_rank === 1",
          },
        ],
        mark: {
          type: "point",
          filled: true,
          size: 65,
          tooltip: true,
        },
        encoding: {
          x: {
            field: "x",
            type: "quantitative",
            axis: null,
            scale: {
              zero: false,
              nice: false,
            },
          },
          y: {
            field: "y",
            type: "quantitative",
            axis: null,
            scale: {
              zero: false,
              nice: false,
            },
          },
        },
      },
    ],
    config: {
      view: { stroke: null },
      // We need negative padding here to allow the chart to go from
      // left to right. For whatever reason, there is a ~3px padding
      // otherwise.
      padding: { left: -3, right: -3, top: 2, bottom: 2 },
      ...(chartType === MetricProto.ChartType.BAR && {
        // Bar chart doesn't need the negative padding:
        padding: { left: 0, right: 0, top: 2, bottom: 2 },
      }),
      mark: {
        tooltip: { content: "encoding" },
        color: getMetricColor(theme, metricColor),
      },
      rule: {
        stroke: theme.colors.borderColorLight,
      },
    },
  }

  spec.config = applyStreamlitTheme(spec.config, theme)
  return spec
}

function Metric({ element }: Readonly<MetricProps>): ReactElement {
  const theme = useEmotionTheme()
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartWidth, chartContainerRef] = useCalculatedWidth()

  const { MetricDirection } = MetricProto
  const {
    body,
    label,
    delta,
    direction,
    color,
    labelVisibility,
    help,
    showBorder,
    chartData,
    chartType,
  } = element

  let metricDirection: EmotionIcon | null = null

  switch (direction) {
    case MetricDirection.DOWN:
      metricDirection = ArrowDownward
      break
    case MetricDirection.UP:
      metricDirection = ArrowUpward
      break
  }

  const arrowMargin = "0 threeXS 0 0"
  const deltaExists = delta !== ""

  useEffect(() => {
    if (
      chartData &&
      chartData.length > 0 &&
      chartRef.current &&
      chartWidth > 0 // Ensure positive width
    ) {
      const spec = getMetricChartSpec(
        chartData,
        chartType,
        chartWidth,
        theme,
        color
      )

      void embed(chartRef.current, spec, {
        actions: false,
        renderer: "svg",
        ast: true,
        expr: expressionInterpreter,
        tooltip: {
          theme: "custom",
          formatTooltip: (value: { y: number }) => {
            return `${value.y}`
          },
        },
      })
    }
  }, [chartData, color, theme, chartWidth, chartType, chartRef])

  return (
    <StyledMetricContainer
      className="stMetric"
      data-testid="stMetric"
      showBorder={showBorder}
    >
      <StyledMetricContent showBorder={showBorder}>
        <StyledMetricLabelText
          data-testid="stMetricLabel"
          visibility={labelVisibilityProtoValueToEnum(labelVisibility?.value)}
        >
          <StyledTruncateText>
            <StreamlitMarkdown source={label} allowHTML={false} isLabel />
          </StyledTruncateText>
          {help && (
            <StyledWidgetLabelHelpInline>
              <TooltipIcon content={help} placement={Placement.TOP_RIGHT} />
            </StyledWidgetLabelHelpInline>
          )}
        </StyledMetricLabelText>
        <StyledMetricValueText data-testid="stMetricValue">
          <StyledTruncateText> {body} </StyledTruncateText>
        </StyledMetricValueText>
        {deltaExists && (
          <StyledMetricDeltaText
            data-testid="stMetricDelta"
            metricColor={color}
          >
            {metricDirection && (
              <Icon
                testid={
                  metricDirection === ArrowUpward
                    ? "stMetricDeltaIcon-Up"
                    : "stMetricDeltaIcon-Down"
                }
                content={metricDirection}
                size="md"
                margin={arrowMargin}
              />
            )}
            <StyledTruncateText> {delta} </StyledTruncateText>
          </StyledMetricDeltaText>
        )}
      </StyledMetricContent>
      {chartData && chartData.length > 0 && (
        <div ref={chartContainerRef}>
          <Global styles={StyledVegaLiteChartTooltips} />
          <StyledMetricChart
            ref={chartRef}
            data-testid="stMetricChart"
            showBorder={showBorder}
          />
        </div>
      )}
    </StyledMetricContainer>
  )
}

export default memo(Metric)
