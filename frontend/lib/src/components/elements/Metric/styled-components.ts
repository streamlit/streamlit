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

import styled from "@emotion/styled"

import { Metric as MetricProto } from "@streamlit/protobuf"

import { StyledWidgetLabel } from "~lib/components/widgets/BaseWidget/styled-components"
import { LabelVisibilityOptions } from "~lib/util/utils"

export interface StyledMetricContainerProps {
  showBorder: boolean
}

export const StyledMetricContainer = styled.div<StyledMetricContainerProps>(
  ({ theme, showBorder }) => ({
    ...(showBorder && {
      border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
      borderRadius: theme.radii.default,
      padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
    }),
  })
)
export interface StyledMetricLabelTextProps {
  visibility?: LabelVisibilityOptions
}

export const StyledTruncateText = styled.div(({ theme }) => ({
  overflowWrap: "normal",
  textOverflow: "ellipsis",
  width: "100%",
  overflow: "hidden",
  whiteSpace: "nowrap",
  fontFamily: theme.genericFonts.bodyFont,
  lineHeight: "normal",
  verticalAlign: "middle",

  // Styles to truncate the text inside the StyledStreamlitMarkdown div.
  "& > div": {
    overflow: "hidden",

    "& > p": {
      textOverflow: "ellipsis",
      overflow: "hidden",
    },
  },
}))

export const StyledMetricLabelText = styled(
  StyledWidgetLabel
)<StyledMetricLabelTextProps>(({ visibility }) => ({
  marginBottom: 0,
  display: visibility === LabelVisibilityOptions.Collapsed ? "none" : "grid",
  gridTemplateColumns:
    visibility === LabelVisibilityOptions.Collapsed ? "initial" : "auto 1fr",
  visibility:
    visibility === LabelVisibilityOptions.Hidden ? "hidden" : "visible",
}))

export const StyledMetricValueText = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.threeXL,
  color: theme.colors.bodyText,
  paddingBottom: theme.spacing.twoXS,
}))

export interface StyledMetricDeltaTextProps {
  metricColor: MetricProto.MetricColor
}

const getMetricColor = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  theme: any,
  color: MetricProto.MetricColor
): string => {
  switch (color) {
    case MetricProto.MetricColor.RED:
      return theme.colors.metricNegativeDeltaColor
    case MetricProto.MetricColor.GREEN:
      return theme.colors.metricPositiveDeltaColor
    // this must be grey
    default:
      return theme.colors.metricNeutralDeltaColor
  }
}

export const StyledMetricDeltaText = styled.div<StyledMetricDeltaTextProps>(
  ({ theme, metricColor }) => ({
    color: getMetricColor(theme, metricColor),
    fontSize: theme.fontSizes.md,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    fontWeight: theme.fontWeights.normal,
  })
)
