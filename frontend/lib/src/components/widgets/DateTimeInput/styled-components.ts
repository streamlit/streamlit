/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
import { getLuminance } from "color2k"
import { DateInput, DateSegment, TimeField } from "react-aria-components"

// Reuse DateInput's quick-select row/label for the popover Time row (shared
// divider + muted-label styling). Changes to DateInput's quick-select will
// propagate here intentionally.
export {
  StyledCalendarCell,
  StyledCalendarGrid,
  StyledCalendarHeaderCell,
  StyledCalendarPopover,
  StyledCalendarRoot,
  StyledClearButton,
  StyledDateField,
  StyledDateFieldContainer,
  StyledDateInputWrapper,
  StyledErrorIconContainer,
  StyledQuickSelectLabel as StyledPopoverTimeLabel,
  StyledQuickSelectRow as StyledPopoverTimeRow,
  StyledTrailingIcons,
  StyledVisuallyHidden,
} from "../DateInput/styled-components"

export const StyledPopoverTimeField = styled(TimeField)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  "&[data-disabled]": {
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))

export const StyledPopoverTimeFieldInput = styled(DateInput)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: `${theme.spacing.twoXS} 0`,
  outline: "none",
}))

export const StyledPopoverTimeSegment = styled(DateSegment)(({ theme }) => {
  const isLightPrimary = getLuminance(theme.colors.primary) > 0.5
  return {
    paddingLeft: theme.spacing.threeXS,
    paddingRight: theme.spacing.threeXS,
    borderRadius: theme.radii.sm,
    color: theme.colors.bodyText,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.normal,
    whiteSpace: "pre" as const,
    caretColor: "transparent",
    outline: "none",
    "&[data-type=literal]": { color: theme.colors.fadedText60, padding: 0 },
    "&[data-placeholder]": { color: theme.colors.fadedText60 },
    "&:hover:not([data-type=literal]):not([data-focused])": {
      backgroundColor: theme.colors.secondaryBg,
    },
    "&[data-focused]": {
      backgroundColor: theme.colors.primary,
      color: isLightPrimary ? theme.colors.black : theme.colors.white,
    },
    "&[data-disabled]": {
      color: "inherit",
    },
  }
})
