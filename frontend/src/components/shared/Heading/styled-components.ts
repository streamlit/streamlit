/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

export const StyledLinkIconContainer = styled.div(() => ({
  position: "relative",
  left: "calc(-2.5rem - 0.5rem)",
  width: "calc(100% + 2.5rem + 0.5rem)",
  display: "flex",
  alignItems: "center",
  overflow: "visible",
  ":hover": {
    a: {
      opacity: 1,
      transform: "scale(1)",
      transition: "none",
    },
  },
}))

export const StyledLinkIcon = styled.a(({ theme }) => ({
  position: "absolute",
  marginRight: "0.5rem",

  // center icon
  lineHeight: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",

  // copied from full screen button
  transform: "scale(0)",
  transition: "opacity 300ms 150ms, transform 300ms 150ms",
  opacity: 0,
  height: "2.5rem",
  width: "2.5rem",
  zIndex: theme.zIndices.sidebar + 1,
  border: "none",
  backgroundColor: theme.colors.lightenedBg05,
  borderRadius: "50%",

  svg: {
    stroke: theme.colors.fadedText60,
  },

  "&:hover svg": {
    stroke: theme.colors.bodyText,
  },
}))

export const StyledHeaderContainer = styled.div(({ theme }) => ({
  "h1, h2, h3, h4, h5, h6, span": {
    scrollMarginTop: theme.spacing.threeXL,
  },

  a: {
    color: theme.colors.linkText,
  },
}))

export const StyledHeaderContent = styled.span(() => ({
  position: "relative",
  flex: "1",
  marginLeft: "calc(2.5rem + 0.5rem)",
}))
