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
})(({ theme }) => {
  const rightInset = `max(0px, calc(${theme.sizes.tagMarginInsideBorder} - var(--scrollbar-gutter-size, 0px)))`

  return {
    position: "relative",
    display: "flex",
    alignItems: "center",
    padding: theme.spacing.none,
    margin: theme.spacing.none,
    height: theme.sizes.dropdownItemHeight,
    background: "transparent",
    fontWeight: theme.fontWeights.normal,

    // Pass insets to StyledHighlightWrapper via CSS custom properties so the
    // highlight background extends to the full item width while keeping text
    // properly inset from the dropdown edges.
    "--highlight-padding-left": `calc(${theme.sizes.tagMarginInsideBorder} + ${theme.spacing.sm})`,
    "--highlight-padding-right": `calc(${rightInset} + ${theme.spacing.sm})`,
  }
})
