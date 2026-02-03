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

interface ThemedStyledDropdownListItemProps {
  $isHighlighted?: boolean
  $isSelectAll?: boolean
  $isCreatable?: boolean
}

/**
 * Calculate the right inset for dropdown items, accounting for scrollbar gutter
 * and border width in dark mode.
 */
function getRightInset(theme: EmotionTheme): string {
  return `max(0px, calc(${theme.spacing.xs} - var(--scrollbar-gutter-size, 0px) - ${theme.sizes.borderWidth}))`
}

export const ThemedStyledDropdownListItem = styled(StyledDropdownListItem, {
  shouldForwardProp: prop =>
    isPropValid(prop) && prop !== "$isSelectAll" && prop !== "$isCreatable",
})<ThemedStyledDropdownListItemProps>(({
  theme,
  $isHighlighted,
  $isSelectAll,
  $isCreatable,
}) => {
  // Separator line style shared by select all (::after) and creatable (::before).
  // The left/right offsets align with the item highlight's edges.
  const separatorStyle = {
    content: '""',
    position: "absolute" as const,
    left: theme.spacing.none,
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
    padding: theme.spacing.none,
    background: "transparent",
    fontWeight: theme.fontWeights.normal,

    // Override the default itemSize set on the component's JSX
    // on mobile, so we can make list items taller and scrollable
    [`@media (max-width: ${theme.breakpoints.md})`]: {
      minHeight: theme.sizes.dropdownItemHeight,
      height: "auto !important",
    },

    // Apply highlight effect and padding to the first div inside the li
    "& > div:first-of-type": {
      flex: 1,
      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.sm,
      paddingTop: theme.spacing.threeXS,
      paddingBottom: theme.spacing.threeXS,
      // Right margin adjusted for scrollbar gutter
      marginRight: getRightInset(theme),
      borderTopLeftRadius: theme.radii.md2,
      borderTopRightRadius: theme.radii.md2,
      borderBottomRightRadius: theme.radii.md2,
      borderBottomLeftRadius: theme.radii.md2,
      background: $isHighlighted
        ? theme.colors.darkenedBgMix15
        : "transparent",
      transition: "background 120ms ease",
    },
    "&:hover > div:first-of-type, &:active > div:first-of-type, &:focus-visible > div:first-of-type":
      {
        background: theme.colors.darkenedBgMix15,
      },
    // Separator line BEFORE creatable "Add:" items (centered on top edge)
    "&::before": $isCreatable
      ? { ...separatorStyle, top: 0, transform: "translateY(-50%)" }
      : undefined,
    // Separator line AFTER select all items (centered on bottom edge)
    "&::after": $isSelectAll
      ? { ...separatorStyle, bottom: 0, transform: "translateY(50%)" }
      : undefined,
  }
})
