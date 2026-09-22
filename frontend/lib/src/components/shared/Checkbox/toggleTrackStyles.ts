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

import type { EmotionTheme } from "~lib/theme/types"

/**
 * Visual state for the `st.toggle` track fill.
 */
type ToggleTrackVisualState = {
  isSelected: boolean
  isHovered?: boolean
  isDisabled?: boolean
}

/**
 * Return the track fill so off-state chrome matches secondary-button hover
 * without following a custom `theme.borderColor`.
 *
 * - Off rest / disabled: `fadedText10` (same default look as `borderColor`,
 *   but not the configurable border token — toggles are a fill, not a stroke)
 * - Off hover: `darkenedBgMix15` (same as unchecked radio/checkbox hover)
 * - On: `primary` (hover does not change this)
 */
export function getToggleTrackColors(
  theme: EmotionTheme,
  { isSelected, isHovered = false, isDisabled = false }: ToggleTrackVisualState
): string {
  if (isSelected && !isDisabled) {
    return theme.colors.primary
  }
  if (isHovered && !isDisabled) {
    return theme.colors.darkenedBgMix15
  }
  return theme.colors.fadedText10
}
