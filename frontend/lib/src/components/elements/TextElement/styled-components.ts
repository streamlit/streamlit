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

import styled from "@emotion/styled"

// Text element itself - rendered inline-block so it stays with help icon
export const StyledText = styled.span(({ theme }) => ({
  fontFamily: theme.genericFonts.bodyFont,
  color: theme.colors.bodyText,
  whiteSpace: "pre-line",
  whiteSpaceCollapse: "preserve",
  wordBreak: "break-word",
  display: "inline-block",
  verticalAlign: "middle",
  width: "100%",
}))

// Inline help icon wrapper to keep it flowing with the text
export const StyledInlineHelpIcon = styled.span(({ theme }) => ({
  display: "inline-block",
  verticalAlign: "middle",
  marginLeft: theme.spacing.twoXS,
  // Fine-tune vertical positioning for perfect visual centering
  transform: "translateY(-0.05em)",
}))
