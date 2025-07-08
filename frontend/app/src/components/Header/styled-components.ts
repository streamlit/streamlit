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

import { EmotionTheme } from "@streamlit/lib"

export const StyledLogoContainer = styled.div(({ theme }) => ({
  marginLeft: theme.spacing.lg,
}))

export interface StyledHeaderProps {
  isTransparentBackground?: boolean
}

export const StyledHeader = styled.header<StyledHeaderProps>(
  ({ theme, isTransparentBackground }) => ({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    display: "flex",
    alignItems: "center",
    height: theme.sizes.headerHeight,
    minHeight: theme.sizes.headerHeight,
    width: "100%",
    background: isTransparentBackground ? "transparent" : theme.colors.bgColor,
    outline: "none",
    zIndex: theme.zIndices.header,
    pointerEvents: isTransparentBackground ? "none" : "auto",
    fontSize: theme.fontSizes.sm,
    "@media print": {
      position: "absolute",
      background: "transparent",
      // Hide all descendants by default
      "& *": {
        display: "none !important",
      },
      // Show the logo container and its parents/contents
      [`& ${StyledLogoContainer}, & ${StyledLogoContainer} *, & :has(${StyledLogoContainer})`]:
        {
          display: "flex !important",
        },
      [`& ${StyledLogoContainer} img`]: {
        display: "block !important",
      },
    },
  })
)

export const StyledHeaderToolbar = styled.div<{
  theme: EmotionTheme
}>(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  height: "100%",
  width: "100%",
  padding: 0,
  pointerEvents: "auto",
  position: "relative",
  zIndex: theme.zIndices.header,
}))

export const StyledOpenSidebarButton = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginLeft: theme.spacing.lg,
  [`@media print`]: {
    display: "none",
  },
}))

export const StyledHeaderContent = styled.div(() => ({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  margin: 0,
  border: 0,
}))

export const StyledHeaderLeftSection = styled.div(() => ({
  display: "flex",
  alignItems: "center",
}))

export const StyledHeaderRightSection = styled.div(({ theme }) => ({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  marginLeft: "auto",
  height: "100%",
  minWidth: theme.sizes.headerRightContentMaxWidth,
  marginRight: theme.spacing.lg,
}))
