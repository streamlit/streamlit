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

import type { CSSObject } from "@emotion/styled"

/**
 * Edge-fade + hidden scrollbar for a wrap=False horizontal scrollport.
 *
 * The mask is driven by `data-can-scroll-start` / `data-can-scroll-end` so the
 * styled class does not rebuild on scroll. Content is masked to transparent
 * (not faded to `bgColor`) so the hint works on sidebar, dialog, and other
 * non-default surfaces. Native scrolling stays available; the bar is hidden so
 * classic OS scrollbars cannot add height and clip the one-row control.
 *
 * Mask direction assumes LTR (physical scrollLeft + `to right` gradient).
 * RTL is out of scope.
 *
 * @param fadeSize Width of each overflowing-edge fade, typically `theme.spacing.lg`.
 * @returns Emotion styles to spread onto the scrollport when wrap is false.
 */
export function getHorizontalOverflowFadeStyles(fadeSize: string): CSSObject {
  const startFade = `transparent 0, black ${fadeSize}`
  const endFade = `black calc(100% - ${fadeSize}), transparent 100%`
  const startMask = `linear-gradient(to right, ${startFade}, black 100%)`
  const endMask = `linear-gradient(to right, black 0, ${endFade})`
  const bothMask = `linear-gradient(to right, ${startFade}, ${endFade})`
  return {
    scrollbarWidth: "none",
    // Keep a horizontal swipe at the end of the row from chaining into the
    // page (or triggering browser back/forward on some trackpads).
    overscrollBehaviorX: "contain",
    // Keep programmatic and keyboard-focus scrolling outside the mask so the
    // :focus-visible ring is not hidden in the fade.
    scrollPaddingInline: fadeSize,
    "&::-webkit-scrollbar": { display: "none" },
    "&[data-can-scroll-start][data-can-scroll-end]": {
      maskImage: bothMask,
      WebkitMaskImage: bothMask,
    },
    "&[data-can-scroll-start]:not([data-can-scroll-end])": {
      maskImage: startMask,
      WebkitMaskImage: startMask,
    },
    "&:not([data-can-scroll-start])[data-can-scroll-end]": {
      maskImage: endMask,
      WebkitMaskImage: endMask,
    },
  }
}
