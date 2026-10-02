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

import { ELEMENT_TOOLBAR_BUTTON_MIN_SIZE_PX } from "~lib/components/shared/BaseButton/styled-components"
import { sizes } from "~lib/theme/primitives/sizes"
import { spacing } from "~lib/theme/primitives/spacing"

/** Spacing/size tokens used to position overlay toolbars above their element. */
export type OverlayToolbarSpacingTheme = {
  spacing: { sm: string; twoXS: string }
  sizes: { smallElementHeight: string }
}

/**
 * Absolute `top` for the overlay toolbar wrapper.
 *
 * Leaves ~`twoXS` between the visible toolbar chrome and the element.
 * Offset is `-(wrapper pad + toolbar pad + button + toolbar pad + gap)`
 * where `button` is `max(smallElementHeight, 24px)` so the gap holds when
 * `baseFontSize` is below 16.
 */
export function getOverlayToolbarTopDistance(
  theme: OverlayToolbarSpacingTheme
): string {
  return `calc(-1 * (${theme.spacing.sm} + ${theme.spacing.twoXS} + max(${theme.sizes.smallElementHeight}, ${ELEMENT_TOOLBAR_BUTTON_MIN_SIZE_PX}) + ${theme.spacing.twoXS} + ${theme.spacing.twoXS}))`
}

/**
 * Bare-embed / print top padding so the first element's overlay toolbar is not
 * clipped. Clears the visible chrome top (`-(topDistance) - sm`) plus a small
 * slack (`0.1rem`).
 */
export function getBareEmbedOverlayToolbarPadding(
  theme: OverlayToolbarSpacingTheme
): string {
  return `calc(${theme.spacing.twoXS} + ${theme.spacing.twoXS} + ${theme.spacing.twoXS} + 0.1rem + max(${theme.sizes.smallElementHeight}, ${ELEMENT_TOOLBAR_BUTTON_MIN_SIZE_PX}))`
}

/** Default-token top used by unit tests. */
export const TOP_DISTANCE = getOverlayToolbarTopDistance({ spacing, sizes })
