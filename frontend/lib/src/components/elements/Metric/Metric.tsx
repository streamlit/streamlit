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
import { convertRemToPx, useEmotionTheme } from "@streamlit/lib"

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
  StyledMetricContainer,
  StyledMetricContent,
  StyledMetricDeltaText,
  StyledMetricLabelText,
  StyledMetricSparkline,
  StyledMetricValueText,
  StyledTruncateText,
} from "./styled-components"

export interface MetricProps {
  element: MetricProto
}

function Metric({ element }: Readonly<MetricProps>): ReactElement {
  const theme = useEmotionTheme()
  const [sparklineWidth, sparklineContainerRef] = useCalculatedWidth()

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
    sparkline,
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

  const sparklineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sparkline && sparklineRef.current) {
      const randomId = Math.random().toString(36).slice(2, 10)
      const baseName = `sparkline_${randomId}`

      const spec: TopLevelSpec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: sparklineWidth,
        height: Math.round(convertRemToPx("3rem")),
        data: {
          values: sparkline.map((value, index) => ({ x: index, y: value })),
        },
        layer: [
          {
            name: `${baseName}_line`,
            mark: "line",
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
                type: "quantitative" as const,
                axis: null,
                scale: {
                  zero: false,
                  nice: false,
                },
              },
              y: {
                field: "y",
                type: "quantitative" as const,
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
          {
            name: `${baseName}_rule`,
            transform: [
              {
                filter: {
                  param: `${baseName}_hover_selection`,
                  empty: false,
                },
              },
            ],
            mark: {
              type: "rule",
              strokeDash: [4, 4],
            },
            encoding: {
              x: {
                field: "x",
                type: "quantitative" as const,
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
          padding: { left: 0, right: 0, top: 2, bottom: 2 },
          mark: {
            tooltip: { content: "encoding" },
            color: getMetricColor(theme, color),
          },
          rule: {
            stroke: theme.colors.borderColorLight,
          },
        },
      }

      spec.config = applyStreamlitTheme(spec.config, theme)

      void embed(sparklineRef.current, spec, {
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
  }, [sparkline, color, theme, sparklineWidth, sparklineRef])

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
      {sparkline && sparkline.length > 0 && (
        <div ref={sparklineContainerRef}>
          <Global styles={StyledVegaLiteChartTooltips} />
          <StyledMetricSparkline
            ref={sparklineRef}
            data-testid="stMetricSparkline"
            showBorder={showBorder}
          />
        </div>
      )}
    </StyledMetricContainer>
  )
}

export default memo(Metric)
