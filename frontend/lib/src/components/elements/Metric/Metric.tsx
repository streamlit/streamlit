/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { ReactElement, useEffect, useRef } from "react"

import { useTheme } from "@emotion/react"
import { ArrowDownward, ArrowUpward } from "@emotion-icons/material-outlined"

import { Metric as MetricProto } from "@streamlit/lib/src/proto"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import { labelVisibilityProtoValueToEnum } from "@streamlit/lib/src/util/utils"
import Icon from "@streamlit/lib/src/components/shared/Icon"
import { StyledWidgetLabelHelpInline } from "@streamlit/lib/src/components/widgets/BaseWidget"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"

import { applyStreamlitTheme } from "@streamlit/lib/src/components/elements/ArrowVegaLiteChart"
import {
  StyledMetricDeltaText,
  StyledMetricLabelText,
  StyledMetricValueText,
  StyledTruncateText,
} from "./styled-components"

import { expressionInterpreter } from "vega-interpreter"
import embed from "vega-embed"

export interface MetricProps {
  element: MetricProto
  width: number
}

export default function Metric({
  element,
  width,
}: Readonly<MetricProps>): ReactElement {
  const theme: EmotionTheme = useTheme()
  const { MetricColor, MetricDirection } = MetricProto

  let direction: any = null
  let color = ""

  const sparkline = element.sparkline

  switch (element.color) {
    case MetricColor.RED:
      color = theme.colors.red
      break
    case MetricColor.GREEN:
      color = theme.colors.green
      break
    // this must be grey
    default:
      color = theme.colors.fadedText60
      break
  }

  switch (element.direction) {
    case MetricDirection.DOWN:
      direction = ArrowDownward
      break
    case MetricDirection.UP:
      direction = ArrowUpward
      break
    // this must be none
    default:
      direction = null
      break
  }

  const arrowMargin = "0 threeXS 0 0"
  const deltaStyle = { color }
  const deltaExists = element.delta !== ""

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
    <div className="stMetric" data-testid="stMetric">
      <StyledMetricLabelText
        data-testid="stMetricLabel"
        visibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
      >
        <StyledTruncateText>
          <StreamlitMarkdown
            source={element.label}
            allowHTML={false}
            isLabel
          />
        </StyledTruncateText>
        {element.help && (
          <StyledWidgetLabelHelpInline>
            <TooltipIcon
              content={element.help}
              placement={Placement.TOP_RIGHT}
            />
          </StyledWidgetLabelHelpInline>
        )}
      </StyledMetricLabelText>
      <StyledMetricValueText data-testid="stMetricValue">
        <StyledTruncateText> {element.body} </StyledTruncateText>
      </StyledMetricValueText>
      {deltaExists && (
        <StyledMetricDeltaText data-testid="stMetricDelta" style={deltaStyle}>
          <Icon
            testid={
              // if direction is null, icon will be null
              direction === ArrowUpward
                ? "stMetricDeltaIcon-Up"
                : "stMetricDeltaIcon-Down"
            }
            content={direction}
            size="lg"
            margin={arrowMargin}
          />
          <StyledTruncateText> {element.delta} </StyledTruncateText>
        </StyledMetricDeltaText>
      )}
      {sparkline && sparkline.length > 0 && (
        <div
          ref={sparklineRef}
          data-testid="stMetricSparkline"
          style={{ marginTop: "0.5rem" }}
        />
      )}
    </div>
  )
}
