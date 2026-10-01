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

import type { CSSObject } from "@emotion/react"

import type { EmotionTheme } from "~lib/theme/types"

export type SecondaryIconButtonColorOptions = {
  /**
   * Also apply the hover color when React Aria sets `data-hovered` (used by
   * Multiselect / Selectbox clear buttons).
   */
  includeDataHovered?: boolean
}

/**
 * Resting / hover / disabled colors for secondary chrome icon buttons
 * (input clear ×, audio mic, chat +, etc.).
 *
 * Resting uses muted `fadedText60`; hover darkens to `bodyText` in light theme
 * (and correspondingly brightens in dark). Do not use `grayTextColor` here —
 * that token is for gray text content, not secondary chrome icons.
 */
export function getSecondaryIconButtonColorStyles(
  theme: EmotionTheme,
  { includeDataHovered = false }: SecondaryIconButtonColorOptions = {}
): CSSObject {
  const hoverSelectors = includeDataHovered
    ? "&:hover:not(:disabled), &:focus:not(:disabled), &[data-hovered]"
    : "&:hover:not(:disabled), &:focus:not(:disabled)"

  return {
    color: theme.colors.fadedText60,
    [hoverSelectors]: {
      color: theme.colors.bodyText,
    },
    "&:disabled, &:disabled:hover, &:disabled:focus": {
      color: theme.colors.fadedText40,
      cursor: "not-allowed",
    },
  }
}
