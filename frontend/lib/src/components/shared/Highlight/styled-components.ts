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

interface StyledHighlightWrapperProps {
  $isHighlighted?: boolean
}

/**
 * Shared styled wrapper for item highlights.
 * Provides consistent highlight/hover effects for list items
 * in Selectbox, Multiselect, and TimeInput dropdowns.
 */
export const StyledHighlightWrapper = styled.div<StyledHighlightWrapperProps>(
  ({ theme, $isHighlighted }) => ({
    flexGrow: 1,
    display: "flex",
    alignItems: "center",
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    // Height matches multiselect tag height
    height: theme.sizes.elementHighlightHeight,
    borderTopLeftRadius: theme.radii.md2,
    borderTopRightRadius: theme.radii.md2,
    borderBottomRightRadius: theme.radii.md2,
    borderBottomLeftRadius: theme.radii.md2,
    background: $isHighlighted ? theme.colors.darkenedBgMix15 : "transparent",
    transition: "background 50ms ease",
    "&:hover, &:active, &:focus-visible": {
      background: theme.colors.darkenedBgMix15,
    },
  })
)
