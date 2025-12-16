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

import { getPrimaryFocusBoxShadow } from "~lib/theme/utils"

export const StyledTooltipTriggerButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  padding: 0,
  margin: 0,
  color: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 0,
  cursor: "help",

  "&:focus": {
    outline: "none",
  },
  "&:focus-visible": {
    boxShadow: getPrimaryFocusBoxShadow(theme),
    borderRadius: theme.radii.default,
  },
}))

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

    // The tooltip hover target wraps the trigger for accessibility.
    // Only style TooltipIcon's default trigger glyph (HelpCircleIcon).
    // TooltipIcon is also used as a wrapper around arbitrary triggers (e.g. a
    // button with its own Icon). Those triggers should keep their own styling.
    "& .stTooltipHoverTarget svg.icon": {
      stroke: theme.colors.fadedText60,
      strokeWidth: 2.25,
    },
  }))

export const StyledLabelHelpWrapper = styled.div<StyledLabelHelpWrapperProps>(
  ({ isLatex }) => ({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    visibility: "visible",
    // For LaTeX, use fit-content to keep icon close, but constrain with maxWidth
    // so long formulas can scroll. Center using margin-inline: auto
    width: isLatex ? "fit-content" : "100%",
    ...(isLatex ? { maxWidth: "100%", marginInline: "auto" } : {}),
  })
)

export const StyledLabelHelpInline = styled.label(({ theme }) => ({
  marginLeft: theme.spacing.xs,
  position: "relative",
  display: "flex",
  flexDirection: "row",
}))
