/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import { Metric as MetricProto } from "src/autogen/proto"
import { Theme } from "src/theme"
import { labelVisibilityProtoValueToEnum } from "src/lib/utils"
import Icon from "src/components/shared/Icon"
import { useTheme } from "@emotion/react"
import { ArrowDownward, ArrowUpward } from "@emotion-icons/material-outlined"
import { StyledWidgetLabelHelpInline } from "src/components/widgets/BaseWidget"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import {
  StyledTruncateText,
  StyledMetricLabelText,
  StyledMetricValueText,
  StyledMetricDeltaText,
} from "./styled-components"

export interface MetricProps {
  element: MetricProto
}

export default function Metric({ element }: MetricProps): ReactElement {
  const { colors }: Theme = useTheme()
  const { MetricColor, MetricDirection } = MetricProto

  let direction: any = null
  let color = ""

  switch (element.color) {
    case MetricColor.RED:
      color = colors.red
      break
    case MetricColor.GREEN:
      color = colors.green
      break
    // this must be grey
    default:
      color = colors.fadedText60
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
    <div data-testid="metric-container">
      <StyledMetricLabelText data-testid="stMetricLabel">
        <StyledTruncateText
          visibility={labelVisibilityProtoValueToEnum(
            element.labelVisibility?.value
          )}
        >
          <StreamlitMarkdown
            source={element.label}
            allowHTML={false}
            isLabel
          />
          {element.help && (
            <StyledWidgetLabelHelpInline>
              <TooltipIcon
                content={element.help}
                placement={Placement.TOP_RIGHT}
              />
            </StyledWidgetLabelHelpInline>
          )}
        </StyledTruncateText>
      </StyledMetricLabelText>
      <StyledMetricValueText data-testid="stMetricValue">
        <StyledTruncateText> {element.body} </StyledTruncateText>
      </StyledMetricValueText>
      {deltaExists && (
        <StyledMetricDeltaText data-testid="stMetricDelta" style={deltaStyle}>
          <Icon content={direction} size="lg" margin={arrowMargin} />
          <StyledTruncateText> {element.delta} </StyledTruncateText>
        </StyledMetricDeltaText>
      )}
    </div>
  )
}
