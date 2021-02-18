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

import isPropValid from "@emotion/is-prop-valid"
import styled from "@emotion/styled"
import { StyledDropdownListItem } from "baseui/select"

export const StyledTruncateText = styled.span({
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
})

export const ThemedStyledDropdownListItem = styled(StyledDropdownListItem, {
  shouldForwardProp: isPropValid,
})(({ theme, $isHighlighted }) => ({
  display: "flex",
  alignItems: "center",
  paddingTop: theme.spacing.none,
  paddingBottom: theme.spacing.none,
  background: $isHighlighted ? theme.colors.lightestGray : undefined,
  "&:hover, &:active, &:focus": {
    background: theme.colors.lightestGray,
  },
}))
