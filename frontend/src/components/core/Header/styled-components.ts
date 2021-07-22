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

import styled from "@emotion/styled"
import { transparentize } from "color2k"

export interface StyledHeaderProps {
  isEmbedded: boolean
  isWideMode: boolean
  isStale?: boolean
}

export const StyledHeader = styled.header<StyledHeaderProps>(
  ({ isEmbedded, isWideMode, theme }) => ({
    position: "fixed",
    top: theme.spacing.none,
    left: theme.spacing.none,
    right: theme.spacing.none,
    height: 0,
    zIndex: theme.zIndices.header,
    display: isEmbedded ? "none" : "block",
    "@media print": {
      display: "none",
    },
    ...(isWideMode
      ? {
          backgroundImage: `linear-gradient(180deg, ${
            theme.colors.bgColor
          } 25%, ${transparentize(theme.colors.bgColor, 0.5)} 75%, ${
            theme.colors.transparent
          })`,
          [`@media (max-width: ${theme.breakpoints.md})`]: {
            position: "absolute",
            background: "unset",
          },
        }
      : {}),
  })
)

export const StyledHeaderDecoration = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.none,
  right: theme.spacing.none,
  left: theme.spacing.none,
  height: "0.125rem",
  backgroundImage: `linear-gradient(90deg, ${theme.colors.red70}, #fffd80)`,
  zIndex: theme.zIndices.header,
}))

export const StyledHeaderToolbar = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.none,
  right: theme.spacing.lg,
  height: theme.sizes.headerHeight,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
}))
