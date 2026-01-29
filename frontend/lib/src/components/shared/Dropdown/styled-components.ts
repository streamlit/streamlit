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

export const ThemedStyledDropdownListItem = styled(StyledDropdownListItem, {
  shouldForwardProp: isPropValid,
})(({ theme, $isHighlighted, $selected }) => {
  const hoverBg = theme.colors.darkenedBgMix15
  const selectedBg = (theme as EmotionTheme).colors?.darkenedBgMix25 ?? hoverBg
  const hasBg = Boolean($selected || $isHighlighted)
  const bgColor = $selected
    ? selectedBg
    : $isHighlighted
      ? hoverBg
      : "transparent"

  return {
    position: "relative",
    display: "flex",
    alignItems: "center",

    marginTop: theme.spacing.none,
    marginBottom: theme.spacing.none,
    marginLeft: theme.spacing.none,
    marginRight: theme.spacing.none,

    borderRadius: theme.radii.default,
    overflow: "hidden",

    // ensure any Base Web inner wrappers cannot paint square backgrounds
    "& *": { backgroundColor: "transparent !important" },
    "& [data-baseweb]": { backgroundColor: "transparent !important" },

    // keep text above our highlight layer

    paddingTop: theme.spacing.none,
    paddingBottom: theme.spacing.none,
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.lg,

    fontSize: theme.fontSizes.md,

    // our rounded highlight - same radius for ALL items
    "::before": {
      content: '""',
      position: "absolute",
      inset: `2px ${theme.spacing.sm}`,
      borderRadius: theme.radii.default, // Consistent rounded corners on all items
      background: bgColor,
      opacity: hasBg ? 1 : 0,
      transition: "opacity 120ms ease",
      pointerEvents: "none",
      zIndex: theme.zIndices.base,
    },

    "& > *": {
      position: "relative",
      zIndex: theme.zIndices.priority,
      paddingTop: theme.spacing.threeXS,
      paddingBottom: theme.spacing.threeXS,
      paddingLeft: theme.spacing.none,
      paddingRight: theme.spacing.none,
    },

    fontWeight: theme.fontWeights.normal,

    [`@media (max-width: ${theme.breakpoints.md})`]: {
      minHeight: theme.sizes.dropdownItemHeight,
      height: "auto !important",
    },
  }
})
