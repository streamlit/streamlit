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

import {
  autoUpdate,
  flip,
  type FlipOptions,
  type Middleware,
  offset,
  type Placement,
  shift,
  type ShiftOptions,
  size,
  useFloating,
} from "@floating-ui/react"

interface UseFloatingOverlayOptions {
  open: boolean
  placement?: Placement
  offsetPx?: number
  flipOptions?: FlipOptions | false
  shiftOptions?: ShiftOptions | false
  matchTriggerWidth?: boolean
  extraMiddleware?: Middleware[]
}

const SHIFT_VIEWPORT_PADDING = 8
const EMPTY_MIDDLEWARE: Middleware[] = []

/**
 * Shared Floating UI positioning hook for overlay components (Popover,
 * Selectbox, MenuButton). Provides scroll-tracking via autoUpdate and
 * viewport-aware repositioning via flip/shift middleware.
 */
export function useFloatingOverlay(
  options: UseFloatingOverlayOptions
): ReturnType<typeof useFloating> {
  const {
    open,
    placement = "bottom-start",
    offsetPx = 0,
    flipOptions,
    shiftOptions,
    matchTriggerWidth,
    extraMiddleware = EMPTY_MIDDLEWARE,
  } = options

  const middleware: Array<Middleware | false | undefined> = [
    offset(offsetPx),
    flipOptions !== false &&
      flip(typeof flipOptions === "object" ? flipOptions : undefined),
    shiftOptions !== false &&
      shift(
        typeof shiftOptions === "object"
          ? shiftOptions
          : { padding: SHIFT_VIEWPORT_PADDING }
      ),
    matchTriggerWidth &&
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
          })
        },
      }),
    ...extraMiddleware,
  ]

  return useFloating({
    open,
    placement,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: middleware.filter(Boolean),
  })
}
