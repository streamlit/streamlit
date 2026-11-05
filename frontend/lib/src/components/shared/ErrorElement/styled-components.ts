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

export const StyledStackTrace = styled.pre(({ theme }) => ({
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
  color: "inherit",
  fontSize: theme.fontSizes.codeFontSize,
  fontFamily: theme.genericFonts.codeFont,
  fontWeight: theme.fontWeights.code,
  backgroundColor: theme.colors.transparent,
  overflowX: "auto",
  margin: 0,
  borderRadius: theme.radii.default,
  /**
   * The inner `StyledCode` is rendered with `wrapLines={false}`, so
   * `codeBlockStyle` puts the right gutter on the `<code>` (`inline-block` +
   * `padding-right`) rather than here. Browsers drop a scroll container's
   * own right padding from its scrollable overflow region, so keeping the
   * gutter on the inner element preserves it at max horizontal scroll.
   * See issue #8206.
   */
  padding: theme.spacing.lg,
  paddingRight: 0,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
}))

export const StyledErrorName = styled.strong(({ theme }) => ({
  fontWeight: theme.fontWeights.codeBold,
}))
