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

import { useTheme } from "@emotion/react"
import { EmotionIcon } from "@emotion-icons/emotion-icon"
import { ArrowDownward, ArrowUpward } from "@emotion-icons/material-outlined"
import { expressionInterpreter } from "vega-interpreter"
import embed from "vega-embed"

import { Metric as MetricProto } from "@streamlit/protobuf"
import { applyStreamlitTheme } from "@streamlit/lib/src/components/elements/ArrowVegaLiteChart"
import { EmotionTheme } from "@streamlit/lib"

import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import Icon from "~lib/components/shared/Icon"
import { StyledWidgetLabelHelpInline } from "~lib/components/widgets/BaseWidget"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import { Placement } from "~lib/components/shared/Tooltip"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"

import {
  StyledMetricContainer,
  StyledMetricDeltaText,
  StyledMetricLabelText,
  StyledMetricValueText,
  StyledTruncateText,
} from "./styled-components"

export interface MetricProps {
  element: MetricProto
  width: number
}

function Metric({ element, width }: Readonly<MetricProps>): ReactElement {
  const theme: EmotionTheme = useTheme()
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
      const spec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width,
        height: 60,
        data: {
          values: sparkline.map((value, index) => ({ x: index, y: value })),
        },
        mark: "line",
        encoding: {
          x: {
            field: "x",
            type: "quantitative",
            axis: null,
            scale: { zero: false, nice: false },
          },
          y: {
            field: "y",
            type: "quantitative",
            axis: null,
            scale: { zero: false, nice: false },
          },
        },
        config: {
          view: { stroke: null },
          padding: { left: 0, right: 0, top: 0, bottom: 0 },
        },
      }
      spec.config = applyStreamlitTheme(spec.config as any, theme)

      embed(sparklineRef.current, spec as any, {
        actions: false,
        renderer: "svg",
        ast: true,
        expr: expressionInterpreter,
        tooltip: {
          theme: "custom",
          formatTooltip: (value: any) => {
            return `${value.y}`
          },
        },
      })
    }
  }, [sparkline, color, theme, width])

  return (
    <StyledMetricContainer
      className="stMetric"
      data-testid="stMetric"
      showBorder={showBorder}
    >
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
        <StyledMetricDeltaText data-testid="stMetricDelta" metricColor={color}>
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
      {sparkline && sparkline.length > 0 && (
        <div
          ref={sparklineRef}
          data-testid="stMetricSparkline"
          style={{ marginTop: "0.5rem" }}
        />
      )}
    </StyledMetricContainer>
  )
}

export default memo(Metric)
