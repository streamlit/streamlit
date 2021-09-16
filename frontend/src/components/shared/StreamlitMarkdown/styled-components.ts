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

  small: {
    color: theme.colors.fadedText60,
    fontSize: theme.fontSizes.sm,
    "p, ol, ul, dl, li": {
      fontSize: "inherit",
    },

    "h1, h2, h3, h4, h5, h6": {
      color: "inherit",
    },

    // sizes taken from default styles, but using em instead of rem, so it
    // inherits the <small>'s shrunk size
    h1: {
      fontSize: "2.25em",
    },
    h2: {
      fontSize: "1.75em",
    },
    h3: {
      fontSize: "1.25em",
    },

    // these are normally shrunk further to 0.8rem, but since we're already
    // inside a small, just make them 1em.
    "h4, h5, h6": {
      fontSize: "1em",
    },
  },
}))

export const StyledLinkIconContainer = styled.div(() => ({
  position: "relative",
  left: "calc(-2.5rem - 0.5rem)",
  width: "calc(100% + 2.5rem + 0.5rem)",
  display: "flex",
  alignItems: "flex-start",
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
  top: "calc(-1.25rem + 0.5em)",
  left: 0,
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

export const StyledHeaderContent = styled.span(() => ({
  position: "relative",
  flex: "1",
  marginLeft: "calc(2.5rem + 0.5rem)",
}))
