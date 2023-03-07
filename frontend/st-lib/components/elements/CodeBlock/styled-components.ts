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

/*
  This is the default prism.js theme for JavaScript, CSS and HTML, but
  stripped of everything except for token styling.

  See https://prismjs.com/download.html#themes=prism&languages=markup+css+clike+javascript
*/
export const StyledPre = styled.pre(({ theme }) => ({
  margin: 0,
  paddingRight: "2.75rem",
  color: theme.colors.bodyText,

  ".token.comment, .token.prolog, .token.doctype, .token.cdata": {
    color: "slategray",
  },

  ".token.punctuation": {
    color: "#999",
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
    fontWeight: "bold",
  },

  ".token.important": {
    color: theme.colors.red70,
    fontWeight: "bold",
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
}))

export const StyledCopyButton = styled.button(({ theme }) => ({
  opacity: 0,
  height: "2.5rem",
  padding: 0,
  width: "2.5rem",
  transition: "opacity 300ms 150ms, transform 300ms 150ms",
  border: "none",
  backgroundColor: theme.colors.transparent,
  color: theme.colors.fadedText60,
  borderRadius: theme.radii.xl,
  transform: "scale(0)",

  "&:active, &:focus, &:hover": {
    opacity: 1,
    transform: "scale(1)",
    outline: "none",
    color: theme.colors.bodyText,
    transition: "none",
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
      opacity: 1,
      transform: "scale(1)",
      outline: "none",
      transition: "none",
    },
  },
}))
