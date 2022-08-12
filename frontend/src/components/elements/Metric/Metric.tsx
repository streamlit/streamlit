import React, { ReactElement } from "react"
import { Metric as MetricProto } from "src/autogen/proto"
import { Theme } from "src/theme"
import Icon from "src/components/shared/Icon"
import { useTheme } from "@emotion/react"
import { ArrowDownward, ArrowUpward } from "@emotion-icons/material-outlined"
import { StyledWidgetLabelHelpInline } from "src/components/widgets/BaseWidget"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"
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
        <StyledTruncateText>
          {element.label}
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
