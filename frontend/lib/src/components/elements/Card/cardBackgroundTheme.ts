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

import { computeDerivedColors } from "~lib/theme/getColors"
import type { EmotionTheme } from "~lib/theme/types"

/**
 * Theme for the contents of a filled card.
 *
 * The card paints the secondary background of its immediate theme context.
 * Its children swap the background and secondary background, so elements that
 * normally sit on the background stay distinguishable on the card. A nested
 * filled card swaps again.
 */
export function createCardBackgroundTheme(theme: EmotionTheme): EmotionTheme {
  const colors = {
    ...theme.colors,
    bgColor: theme.colors.secondaryBg,
    secondaryBg: theme.colors.bgColor,
  }
  return {
    ...theme,
    colors: { ...colors, ...computeDerivedColors(colors) },
  }
}
