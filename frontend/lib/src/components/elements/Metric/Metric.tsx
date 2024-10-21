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

import React, { ReactElement } from "react"

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

import {
  StyledMetricDeltaText,
  StyledMetricLabelText,
  StyledMetricValueText,
  StyledTruncateText,
} from "./styled-components"

export interface MetricProps {
  element: MetricProto
}

export default function Metric({
  element,
}: Readonly<MetricProps>): ReactElement {
  const { colors }: EmotionTheme = useTheme()
  const { MetricColor, MetricDirection } = MetricProto

  let direction: any = null
  let color = ""

  switch (element.color) {
    case MetricColor.RED:
      color = colors.metricNegativeDeltaColor
      break
    case MetricColor.GREEN:
      color = colors.metricPositiveDeltaColor
      break
    // this must be grey
    default:
      color = colors.metricNeutralDeltaColor
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
    </div>
  )
}
