/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { Theme } from "@emotion/react"
import styled from "@emotion/styled"

const codeLink = {
  // Streamline the style when inside anchors to avoid broken underline and more
  "a > &": {
    color: "inherit",
  },
}

export const StyledInlineCode = styled.code(({ theme }) => ({
  padding: "0.2em 0.4em",
  wordWrap: "break-word",
  margin: 0,
  borderRadius: theme.radii.md,
  background: theme.colors.codeHighlightColor,
  color: theme.colors.codeTextColor,
  fontFamily: theme.genericFonts.codeFont,
  // Use em here so that it works correctly within captions
  fontSize: "0.75em",

  ...codeLink,
}))

const codeBlockStyle = (theme: Theme): React.CSSProperties => ({
  background: "transparent",
  border: 0,
  color: "inherit",
  display: "inline",
  fontSize: theme.fontSizes.sm,
  lineHeight: "inherit",
  margin: 0,
  overflowX: "auto",
  padding: 0,
  whiteSpace: "pre",
  wordBreak: "normal",
  wordWrap: "normal",
  ...codeLink,
})

export const StyledCode = styled.code(({ theme }) => ({
  ...codeBlockStyle(theme),
}))

/*
  This is the default prism.js theme for JavaScript, CSS and HTML, but
  stripped of everything except for token styling.

  See https://prismjs.com/download.html#themes=prism&languages=markup+css+clike+javascript
*/
export const StyledPre = styled.pre(({ theme }) => ({
  background: theme.colors.codeHighlightColor,
  borderRadius: theme.radii.default,
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.twoSm,
  display: "block",
  // Remove browser default top margin
  margin: 0,
  // Disable auto-hiding scrollbar in legacy Edge to avoid overlap,
  // making it impossible to interact with the content
  msOverflowStyle: "scrollbar",

  // Don't allow content to break outside
  overflow: "auto",
  // Add padding
  padding: theme.spacing.lg,
  // Add padding to the right to account for the copy button
  paddingRight: theme.iconSizes.threeXL,

  code: { ...codeBlockStyle(theme) },

  // The token can consist of many lines, e.g. a triple-quote string, so
  // we need to make sure that the color is not overwritten.
  ".comment.linenumber": {
    color: theme.colors.fadedText40,
    fontSize: theme.fontSizes.twoSm,

    // Center-align number vertically, or they'll be positioned differently when
    // wrapLinst=true. Even with this change, though, the position is still ~2px
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
    fontWeight: theme.fontWeights.extrabold,
  },

  ".token.important": {
    color: theme.colors.red70,
    fontWeight: theme.fontWeights.extrabold,
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
}))

export const StyledCopyButtonContainer = styled.div(({ theme }) => ({
  opacity: 0,
  padding: `${theme.spacing.sm} ${theme.spacing.sm} 0 0`,
  top: 0,
  right: 0,
  position: "absolute",
  width: "100%",
  height: "100%",
  backgroundColor: theme.colors.transparent,
  zIndex: theme.zIndices.sidebar + 1,
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "flex-start",
  transition: "opacity 300ms 150ms",
  pointerEvents: "none",
}))

export const StyledCodeBlock = styled.div(({ theme }) => ({
  position: "relative",
  marginLeft: theme.spacing.none,
  marginRight: theme.spacing.none,
  marginTop: theme.spacing.none,
  marginBottom: undefined,

  "&:hover": {
    [`${StyledCopyButtonContainer}`]: {
      opacity: 1,
    },
  },
}))

export const StyledCopyButton = styled.button(({ theme }) => ({
  pointerEvents: "auto",
  height: theme.iconSizes.threeXL,
  width: theme.iconSizes.threeXL,
  padding: theme.spacing.none,
  border: "none",
  backgroundColor: theme.colors.transparent,
  color: theme.colors.fadedText60,
  transform: "scale(0)",

  [`${StyledCodeBlock}:hover &, &:active, &:focus, &:hover`]: {
    opacity: 1,
    transform: "scale(1)",
    outline: "none",
    transition: "none",
    color: theme.colors.bodyText,
  },
}))
