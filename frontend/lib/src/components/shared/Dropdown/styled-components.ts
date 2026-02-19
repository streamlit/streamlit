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

import isPropValid from "@emotion/is-prop-valid"
import styled from "@emotion/styled"
import { StyledDropdownListItem } from "baseui/select"

import { EmotionTheme } from "~lib/theme"

/**
 * Calculate the right inset for dropdown items, accounting for scrollbar gutter
 * and border width in dark mode.
 */
function getRightInset(theme: EmotionTheme): string {
  return `max(0px, calc(${theme.sizes.tagMarginInsideBorder} - var(--scrollbar-gutter-size, 0px)))`
}

interface ThemedStyledDropdownListItemProps {
  $isSelectAll?: boolean
  $isCreatable?: boolean
  $isGroupHeader?: boolean
}

export const ThemedStyledDropdownListItem = styled(StyledDropdownListItem, {
  shouldForwardProp: prop =>
    isPropValid(prop) &&
    prop !== "$isSelectAll" &&
    prop !== "$isCreatable" &&
    prop !== "$isGroupHeader",
})<ThemedStyledDropdownListItemProps>(({
  theme,
  $isSelectAll,
  $isCreatable,
  $isGroupHeader,
}) => {
  const separatorStyle = {
    content: '""',
    position: "absolute" as const,
    left: theme.sizes.tagMarginInsideBorder,
    right: getRightInset(theme),
    height: theme.sizes.borderWidth,
    backgroundColor: theme.colors.fadedText10,
  }

  return {
    position: "relative",
    display: "flex",
    alignItems: "center",

    margin: theme.spacing.none,
    height: theme.sizes.dropdownItemHeight,
    paddingTop: theme.spacing.none,
    paddingBottom: theme.spacing.none,
    paddingLeft: theme.sizes.tagMarginInsideBorder,
    paddingRight: getRightInset(theme),
    background: "transparent",
    fontWeight: theme.fontWeights.normal,

    ...($isGroupHeader && {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.fadedText60,
    }),

    [`@media (max-width: ${theme.breakpoints.md})`]: {
      minHeight: theme.sizes.dropdownItemHeight,
      height: "auto !important",
    },

    // Separator line BEFORE creatable "Add:" items
    "&::before": $isCreatable
      ? { ...separatorStyle, top: 0, transform: "translateY(-50%)" }
      : undefined,
    // Separator line AFTER select all items (centered on bottom edge)
    "&::after": $isSelectAll
      ? { ...separatorStyle, bottom: 0, transform: "translateY(50%)" }
      : undefined,
  }
})

export const GroupHeaderRule = styled.span(({ theme }) => ({
  flex: 1,
  height: theme.sizes.borderWidth,
  backgroundColor: theme.colors.fadedText10,
  marginLeft: theme.spacing.sm,
}))
