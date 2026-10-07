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

interface StyledTextProps {
  $truncate?: boolean
}

// Keep text and help aligned; truncation uses flex so the text can shrink
// while the help icon remains visible.
export const StyledText = styled.span<StyledTextProps>(
  ({ theme, $truncate }) => ({
    fontFamily: theme.genericFonts.bodyFont,
    color: theme.colors.bodyText,
    verticalAlign: "middle",
    width: "100%",
    // `white-space` is a shorthand that resets collapse; set preserve after
    // it so extra spaces and tabs stay visible (GH#10062).
    ...($truncate
      ? {
          whiteSpace: "nowrap",
          whiteSpaceCollapse: "preserve",
          wordBreak: "normal",
          display: "flex",
          alignItems: "center",
          minWidth: 0,
          overflow: "hidden",
        }
      : {
          whiteSpace: "pre-line",
          whiteSpaceCollapse: "preserve",
          wordBreak: "break-word",
          display: "inline-block",
        }),
  })
)

export const StyledTextBody = styled.span({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  whiteSpaceCollapse: "preserve",
  minWidth: 0,
  // Fill the flex row so inherited text-align still positions short copy
  // while the help icon stays at the end.
  flex: 1,
})

// Inline help icon wrapper to keep it flowing with the text
export const StyledInlineHelpIcon = styled.span(({ theme }) => ({
  display: "inline-block",
  verticalAlign: "middle",
  marginLeft: theme.spacing.twoXS,
  flexShrink: 0,
  // Fine-tune vertical positioning for perfect visual centering
  transform: "translateY(-0.05em)",
}))
