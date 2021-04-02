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

export const StyledStreamlitMarkdown = styled.div(({ theme }) => ({
  fontFamily: theme.genericFonts.bodyFont,
  marginBottom: `-${theme.spacing.lg}`,
  a: {
    color: theme.colors.linkText,
  },

  li: {
    margin: "0.2em 0 0.2em 1.2em",
    padding: "0 0 0 0.6em",
    fontSize: theme.fontSizes.md,
  },

  tr: {
    borderTop: `1px solid ${theme.colors.fadedText10}`,
  },

  "th, td": {
    padding: "6px 13px",
    border: `1px solid ${theme.colors.fadedText10}`,
  },
}))

export const StyledLinkIconContainer = styled.div(() => ({
  position: "relative",
  left: "calc(-2.5rem - 0.5rem)",
  width: "calc(100% + 2.5rem + 0.5rem)",
  display: "flex",
  alignItems: "flex-start",
  height: "1em",
  overflow: "visible",
  ":hover": {
    a: {
      opacity: 0.75,
    },
  },
}))

export const StyledLinkIcon = styled.a(({ theme }) => ({
  position: "relative",
  top: "calc(-1.25rem + 0.5em)",
  left: 0,
  marginRight: "0.5rem",

  // center icon
  lineHeight: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",

  // copied from full screen button
  transition: "opacity 300ms",
  opacity: 0,
  height: "2.5rem",
  width: "2.5rem",
  zIndex: theme.zIndices.sidebar + 1,
  border: "none",
  backgroundColor: theme.colors.bgColor,
  borderRadius: theme.radii.xl,

  svg: {
    stroke: theme.colors.bodyText,
  },
}))

export const StyledHeaderContent = styled.span(() => ({
  position: "relative",
}))
