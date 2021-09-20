/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import styled from "@emotion/styled"
import { StyledWidgetLabel } from "src/components/widgets/BaseWidget/styled-components"

export const StyledTruncateText = styled.div(({ theme }) => ({
  overflowWrap: "normal",
  textOverflow: "ellipsis",
  width: "100%",
  overflow: "hidden",
  whiteSpace: "nowrap",
  fontFamily: theme.genericFonts.bodyFont,
  lineHeight: theme.lineHeights.normal,
}))

export const StyledMetricLabelText = styled(StyledWidgetLabel)(
  ({ theme }) => ({
    marginBottom: 0,
  })
)

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
