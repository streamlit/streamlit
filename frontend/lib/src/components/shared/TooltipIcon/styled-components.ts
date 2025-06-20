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

interface StyledTooltipIconWrapperProps {
  isLatex?: boolean
}

interface StyledLabelHelpWrapperProps {
  isLatex?: boolean
}

export const StyledTooltipIconWrapper =
  styled.div<StyledTooltipIconWrapperProps>(({ isLatex, theme }) => ({
    display: "flex",
    alignItems: "center",
    marginTop: isLatex ? theme.spacing.md : "0",

    "& .stTooltipHoverTarget > svg": {
      stroke: theme.colors.fadedText60,
      strokeWidth: 2.25,
    },
  }))

export const StyledLabelHelpWrapper = styled.div<StyledLabelHelpWrapperProps>(
  ({ isLatex }) => ({
    display: "flex",
    visibility: "visible",
    verticalAlign: "middle",
    flexDirection: "row",
    alignItems: "center",
    ...(isLatex ? { justifyContent: "center" } : {}),
  })
)

export const StyledLabelHelpInline = styled.label(({ theme }) => ({
  marginLeft: theme.spacing.xs,
  position: "relative",
  display: "flex",
  flexDirection: "row",
}))
