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

import styled from "@emotion/styled"
import { StyledWidgetLabel } from "src/components/widgets/BaseWidget/styled-components"
import { LabelVisibilityOptions } from "src/lib/utils"

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
  lineHeight: theme.lineHeights.normal,
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
  display: visibility === LabelVisibilityOptions.Collapsed ? "none" : "flex",
  visibility:
    visibility === LabelVisibilityOptions.Hidden ? "hidden" : "visible",
}))

export const StyledMetricValueText = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.threeXL,
  color: theme.colors.textColor,
  paddingBottom: theme.spacing.twoXS,
}))

export const StyledMetricDeltaText = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.md,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  fontWeight: theme.fontWeights.normal,
}))
