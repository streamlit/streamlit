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
  borderRadius: theme.radii.md,
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
