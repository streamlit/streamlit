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

import { useCallback } from "react"

import {
  autoUpdate,
  flip,
  type FlipOptions,
  type Middleware,
  offset,
  type OpenChangeReason,
  type Placement,
  type ReferenceType,
  shift,
  type ShiftOptions,
  size,
  useFloating,
} from "@floating-ui/react"

interface UseFloatingOverlayOptions {
  open: boolean
  onOpenChange?: (
    open: boolean,
    event?: Event,
    reason?: OpenChangeReason
  ) => void
  placement?: Placement
  offsetPx?: number
  flipOptions?: FlipOptions | false
  shiftOptions?: ShiftOptions | false
  matchTriggerWidth?: boolean
  extraMiddleware?: Middleware[]
}

/**
 * Default padding (px) kept between a shifted overlay and its boundary edge.
 * Exported so callers that override `shiftOptions` (e.g. to set a boundary) can
 * preserve the same padding instead of falling back to Floating UI's 0 default.
 */
export const SHIFT_VIEWPORT_PADDING = 8
const EMPTY_MIDDLEWARE: Middleware[] = []

type UseFloatingReturn = ReturnType<typeof useFloating>

type UseFloatingOverlayReturn = UseFloatingReturn & {
  setFloating: (node: HTMLElement | null) => void
  setReference: (node: ReferenceType | null) => void
}

/**
 * Shared Floating UI positioning hook for overlay components (Popover,
 * Selectbox, MenuButton). Provides scroll-tracking via autoUpdate and
 * viewport-aware repositioning via flip/shift middleware.
 *
 * Pass `setFloating` and `setReference` as callback refs. Floating UI types
 * `refs.setFloating` and `refs.setReference` as methods, so passing them
 * unbound fails `@typescript-eslint/unbound-method`.
 */
export function useFloatingOverlay(
  options: UseFloatingOverlayOptions
): UseFloatingOverlayReturn {
  const {
    open,
    onOpenChange,
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

  const floating = useFloating({
    open,
    onOpenChange,
    placement,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: middleware.filter(Boolean),
  })

  const setFloating = useCallback(
    (node: HTMLElement | null) => {
      floating.refs.setFloating(node)
    },
    [floating.refs]
  )
  const setReference = useCallback(
    (node: ReferenceType | null) => {
      floating.refs.setReference(node)
    },
    [floating.refs]
  )

  return {
    ...floating,
    setFloating,
    setReference,
  }
}
