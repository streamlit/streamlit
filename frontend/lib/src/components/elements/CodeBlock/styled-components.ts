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

import { CSSObject, Theme } from "@emotion/react"
import styled from "@emotion/styled"

import { StyledToolbar } from "~lib/components/shared/Toolbar/styled-components"

const codeLink: CSSObject = {
  // Streamline the style when inside anchors to avoid broken underline and more
  "a > &": {
    color: "inherit",
  },
}

export const StyledInlineCode = styled.code(({ theme }) => ({
  padding: "0.2em 0.4em",
  overflowWrap: "break-word",
  whiteSpace: "pre-wrap",
  margin: 0,
  borderRadius: theme.radii.sm,
  background: theme.colors.codeBackgroundColor,
  color: theme.colors.codeTextColor,
  fontFamily: theme.genericFonts.codeFont,
  // Use em here so that it works correctly within headers, captions,
  // sidebar, etc.
  fontSize: theme.fontSizes.inlineCodeFontSize,
  fontWeight: theme.fontWeights.code,

  ...codeLink,
}))

type StyledCodeProps = {
  wrapLines: boolean
}

const codeBlockStyle = (
  theme: Theme,
  wrapLines: StyledCodeProps["wrapLines"]
): CSSObject => ({
  background: "transparent",
  border: 0,
  color: "inherit",
  display: "inline",
  fontFamily: theme.genericFonts.codeFont,
  fontSize: theme.fontSizes.codeFontSize,
  fontWeight: theme.fontWeights.code,
  lineHeight: "inherit",
  margin: 0,
  overflowX: "auto",
  padding: 0,
  whiteSpace: wrapLines ? "pre-wrap" : "pre",
  overflowWrap: wrapLines ? "break-word" : "normal",
  ...codeLink,
})

export const StyledCode = styled.code<StyledCodeProps>(
  ({ theme, wrapLines }) => ({
    ...codeBlockStyle(theme, wrapLines),
  })
)

/*
  This is the default prism.js theme for JavaScript, CSS and HTML, but
  stripped of everything except for token styling.

  See https://prismjs.com/download.html#themes=prism&languages=markup+css+clike+javascript
*/
export const StyledPre = styled.pre<StyledCodeProps>(
  ({ theme, wrapLines }) => ({
    height: "100%",
    background: theme.colors.codeBackgroundColor,
    borderRadius: theme.radii.default,
    color: theme.colors.bodyText,
    fontSize: theme.fontSizes.twoSm,
    fontFamily: theme.genericFonts.codeFont,
    display: "block",
    // Remove browser default top margin
    margin: 0,
    // Disable auto-hiding scrollbar in legacy Edge to avoid overlap,
    // making it impossible to interact with the content
    msOverflowStyle: "scrollbar",

    // Don't allow content to break outside
    overflow: "auto",

    // Add padding around the code
    padding: theme.spacing.lg,

    code: { ...codeBlockStyle(theme, wrapLines) },

    // The token can consist of many lines, e.g. a triple-quote string, so
    // we need to make sure that the color is not overwritten.
    ".comment.linenumber": {
      color: theme.colors.fadedText40,
      fontSize: theme.fontSizes.twoSm,

      // Center-align number vertically, or they'll be positioned differently when
      // wrapLines=true. Even with this change, though, the position is still ~2px
      // off.
      // NOTE: The alignSelf below only apply applies when wrapLines=true, because
      // that option wraps this element in a flex container.
      alignSelf: "center",

      // Override the default token's min-width, to ensure it fits 3-digit lines
      minWidth: `${theme.spacing.threeXL} !important`,
    },

    ".token.comment, .token.prolog, .token.doctype, .token.cdata": {
      color: theme.colors.gray70,
    },

    ".token.punctuation": {
      color: theme.colors.gray70,
    },

    ".namespace": {
      opacity: 0.7,
    },

    ".token.attr-name, .token.property, .token.variable": {
      color: theme.colors.lightBlue80,
    },

    ".token.boolean, .token.constant, .token.symbol": {
      color: theme.colors.green70,
    },

    ".token.number, .token.regex": {
      color: theme.colors.blueGreen80,
    },

    ".token.string, .token.char, .token.attr-value": {
      color: theme.colors.green80,
    },

    ".token.operator, .token.entity": {
      color: theme.colors.orange90,
    },

    ".token.url": {
      color: theme.colors.purple80,
    },

    ".token.decorator, .token.atrule": {
      color: theme.colors.orange90,
    },

    ".token.keyword, .token.tag": {
      color: theme.colors.blue70,
    },

    ".token.function, .token.class-name, .token.selector": {
      color: theme.colors.blue70,
      fontWeight: theme.fontWeights.codeExtraBold,
    },

    ".token.important": {
      color: theme.colors.red70,
      fontWeight: theme.fontWeights.codeExtraBold,
    },

    ".token.comment": {
      color: theme.colors.gray70,
      fontStyle: "italic",
    },

    ".token.italic": {
      fontStyle: "italic",
    },

    ".token.entity": {
      cursor: "help",
    },

    /**
     * Diff syntax highlighting
     */
    ".token.deleted.line, .token.deleted.prefix": {
      color: theme.colors.red70,
    },
    ".token.inserted.line, .token.inserted.prefix": {
      color: theme.colors.green70,
    },
    ".token.unchanged.line": {
      color: theme.colors.gray70,
    },
  })
)

const CODE_TOOLBAR_OPACITY_TRANSITION = "opacity 300ms 150ms"
const CODE_TOOLBAR_HIDE_TRANSITION = `${CODE_TOOLBAR_OPACITY_TRANSITION}, visibility 0ms linear 450ms`
const CODE_TOOLBAR_SHOW_TRANSITION = `${CODE_TOOLBAR_OPACITY_TRANSITION}, visibility 0ms linear 150ms`

export const StyledCodeToolbarWrapper = styled.div(({ theme }) => ({
  opacity: 0,
  // Keep it out of hit testing and screen rendering while hidden.
  visibility: "hidden",
  padding: `${theme.spacing.sm} ${theme.spacing.sm} 0 0`,
  top: 0,
  right: 0,
  position: "absolute",
  zIndex: theme.zIndices.sidebar + 1,
  pointerEvents: "none",
  // Keep the delayed fade-in, but only hide visibility after fade-out completes.
  transition: CODE_TOOLBAR_HIDE_TRANSITION,
}))

export const StyledCodeBlock = styled.div(({ theme }) => ({
  height: "100%",
  position: "relative",
  borderRadius: theme.radii.default,
  marginLeft: theme.spacing.none,
  marginRight: theme.spacing.none,
  marginTop: theme.spacing.none,
  marginBottom: undefined,

  "&:focus": {
    outline: "none",
  },
  "&:focus-visible": {
    boxShadow: theme.shadows.focusRing,
  },

  // Keep the toolbar visible while hovering, when the container itself has
  // keyboard focus, and for keyboard focus within the toolbar.
  // Mouse clicks can focus the button too; gating descendant focus on
  // :focus-visible avoids leaving the toolbar pinned after pointer interactions.
  "&:hover, &:focus-visible, &:focus-within:has(:focus-visible)": {
    [`${StyledCodeToolbarWrapper}`]: {
      opacity: 1,
      visibility: "visible",
      pointerEvents: "auto",
      // Match visibility timing to opacity delay so it is never clickable while invisible.
      transition: CODE_TOOLBAR_SHOW_TRANSITION,
    },
  },
}))

export const StyledCodeToolbar = styled(StyledToolbar)({
  pointerEvents: "auto",
})
