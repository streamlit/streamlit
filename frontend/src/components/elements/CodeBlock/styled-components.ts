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

/*
  This is the default prism.js theme for JavaScript, CSS and HTML, but
  stripped of everything except for token styling.

  See https://prismjs.com/download.html#themes=prism&languages=markup+css+clike+javascript
*/
export const StyledPre = styled.pre(({ theme }) => ({
  margin: 0,
  paddingRight: "2.75rem",

  ".token.comment, .token.prolog, .token.doctype, .token.cdata": {
    color: "slategray",
  },

  ".token.punctuation": {
    color: "#999",
  },

  ".namespace": {
    opacity: 0.7,
  },

  ".token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol, .token.deleted": {
    color: "#905",
  },

  ".token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted": {
    color: "#690",
  },

  ".token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string": {
    color: "#9a6e3a",
  },

  ".token.atrule, .token.attr-value, .token.keyword": {
    color: "#07a",
  },

  ".token.function, .token.class-name": {
    color: "#dd4a68",
  },

  ".token.regex, .token.important, .token.variable": {
    color: "#e90",
  },

  ".token.important, .token.bold": {
    fontWeight: "bold",
  },

  ".token.italic": {
    fontStyle: "italic",
  },

  ".token.entity": {
    cursor: "help",
  },
}))

export const StyledCopyButton = styled.button(({ theme }) => ({
  opacity: 0,
  height: "2.5rem",
  padding: 0,
  width: "2.5rem",
  transition: "opacity 300ms",
  border: "none",
  backgroundColor: theme.colors.transparent,
  color: theme.colors.bodyText,
  borderRadius: theme.radii.xl,

  "&:active, &:focus, &:hover": {
    opacity: 0.75,
    outline: "none",
  },
}))

export const StyledCopyButtonContainer = styled.div(({ theme }) => ({
  padding: `${theme.spacing.sm} ${theme.spacing.sm} 0 0`,
  top: 0,
  right: 0,
  position: "absolute",
  width: "2.75rem",
  height: "100%",
  backgroundColor: theme.colors.transparent,
  zIndex: theme.zIndices.sidebar + 1,
}))

export const StyledCodeBlock = styled.div(({ theme }) => ({
  position: "relative",
  marginLeft: theme.spacing.none,
  marginRight: theme.spacing.none,
  marginTop: theme.spacing.none,
  marginBottom: theme.spacing.lg,
  "&:hover": {
    [StyledCopyButton as any]: {
      opacity: 0.75,
    },
  },
}))
