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

export const StyledClearIconContainer = styled.div({
  position: "absolute",
  top: "50%",
  right: "2.05em",
})

export const StyledTimeDropdownListItem = styled(StyledDropdownListItem, {
  shouldForwardProp: isPropValid,
})(({ theme, $isHighlighted }) => {
  return {
    position: "relative",
    display: "flex",
    alignItems: "center",

    margin: theme.spacing.none,
    height: theme.sizes.dropdownItemHeight,
    padding: theme.spacing.none,
    background: "transparent",
    fontWeight: theme.fontWeights.normal,

    // Apply highlight effect and padding to the first div inside the li
    "& > div:first-of-type": {
      flex: 1,
      display: "flex",
      alignItems: "center",
      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.sm,
      // Height matches multiselect tag height: minElementHeight - 2 * spacing.xs
      // This ensures visual consistency between selected tags and dropdown highlights
      height: `calc(${theme.sizes.minElementHeight} - 2 * ${theme.spacing.xs})`,
      // Margins for inset from edges (xs - borderWidth to account for popover border)
      marginLeft: `calc(${theme.spacing.xs} - ${theme.sizes.borderWidth})`,
      // Right margin also accounts for scrollbar gutter when present
      marginRight: `max(0px, calc(${theme.spacing.xs} - var(--scrollbar-gutter-size, 0px) - ${theme.sizes.borderWidth}))`,
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
  }
})
