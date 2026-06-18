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
  createContext,
  type CSSProperties,
  memo,
  type MutableRefObject,
  ReactElement,
  ReactNode,
  type Ref,
  useContext,
  useLayoutEffect,
  useRef,
} from "react"

import { useFocusable, useFocusWithin } from "react-aria"
import {
  type Placement as RAPlacement,
  TooltipTrigger,
  TooltipTriggerStateContext,
} from "react-aria-components"

import { useWindowDimensionsContext } from "~lib/components/shared/WindowDimensions/useWindowDimensionsContext"

import {
  StyledTooltip,
  StyledTooltipContentWrapper,
} from "./styled-components"

export enum Placement {
  AUTO = "auto",
  TOP_LEFT = "topLeft",
  TOP = "top",
  TOP_RIGHT = "topRight",
  RIGHT_TOP = "rightTop",
  RIGHT = "right",
  RIGHT_BOTTOM = "rightBottom",
  BOTTOM_RIGHT = "bottomRight",
  BOTTOM = "bottom",
  BOTTOM_LEFT = "bottomLeft",
  LEFT_BOTTOM = "leftBottom",
  LEFT = "left",
  LEFT_TOP = "leftTop",
}

/**
 * Maps Streamlit's Placement enum to React Aria placement strings.
 *
 * React Aria flips to the opposite side automatically when there is not
 * enough space (shouldFlip defaults to true).
 */
const REACT_ARIA_PLACEMENT: Record<Placement, RAPlacement> = {
  [Placement.AUTO]: "top",
  [Placement.TOP]: "top",
  [Placement.TOP_LEFT]: "top start",
  [Placement.TOP_RIGHT]: "top end",
  [Placement.BOTTOM]: "bottom",
  [Placement.BOTTOM_LEFT]: "bottom left",
  [Placement.BOTTOM_RIGHT]: "bottom right",
  [Placement.LEFT]: "left",
  [Placement.LEFT_TOP]: "left top",
  [Placement.LEFT_BOTTOM]: "left bottom",
  [Placement.RIGHT]: "right",
  [Placement.RIGHT_TOP]: "right top",
  [Placement.RIGHT_BOTTOM]: "right bottom",
}

export interface TooltipProps {
  content: ReactNode
  placement: Placement
  children: ReactNode
  inline?: boolean
  style?: CSSProperties
  onMouseEnterDelay?: number
  containerWidth?: boolean
  error?: boolean
}

/** Shared ref to the trigger's DOM element, readable inside the tooltip portal. */
const TriggerRefContext = createContext<MutableRefObject<Element | null>>({
  current: null,
})
TriggerRefContext.displayName = "TriggerRefContext"

/** px gap between trigger edge and tooltip edge */
const TOOLTIP_OFFSET = 10
/** px minimum distance between tooltip edge and viewport edge */
const TOOLTIP_PADDING = 8

/**
 * Computes `position: fixed` (x, y) coordinates for the tooltip overlay using
 * getBoundingClientRect() on the trigger. The result is always viewport-relative
 * and correct regardless of page scroll, CSS transform ancestors, or any other
 * DOM complexities that trip up React Aria's useOverlayPosition.
 */
function computeTooltipTransform(
  triggerRect: DOMRect,
  overlayW: number,
  overlayH: number,
  placement: RAPlacement,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } {
  const parts = (placement as string).split(" ")
  const primaryAxis = parts[0]
  const secondaryAxis = parts[1]
  let x: number
  let y: number

  if (primaryAxis === "bottom") {
    y = triggerRect.bottom + TOOLTIP_OFFSET
    x = computeCrossAxisX(triggerRect, overlayW, secondaryAxis)
    if (y + overlayH > viewportHeight - TOOLTIP_PADDING) {
      y = triggerRect.top - overlayH - TOOLTIP_OFFSET
    }
  } else if (primaryAxis === "left") {
    x = triggerRect.left - overlayW - TOOLTIP_OFFSET
    y = computeCrossAxisY(triggerRect, overlayH, secondaryAxis)
    if (x < TOOLTIP_PADDING) {
      x = triggerRect.right + TOOLTIP_OFFSET
    }
  } else if (primaryAxis === "right") {
    x = triggerRect.right + TOOLTIP_OFFSET
    y = computeCrossAxisY(triggerRect, overlayH, secondaryAxis)
    if (x + overlayW > viewportWidth - TOOLTIP_PADDING) {
      x = triggerRect.left - overlayW - TOOLTIP_OFFSET
    }
  } else {
    // "top" (default) and "auto"
    y = triggerRect.top - overlayH - TOOLTIP_OFFSET
    x = computeCrossAxisX(triggerRect, overlayW, secondaryAxis)
    if (y < TOOLTIP_PADDING) {
      y = triggerRect.bottom + TOOLTIP_OFFSET
    }
  }

  x = Math.max(
    TOOLTIP_PADDING,
    Math.min(x, viewportWidth - overlayW - TOOLTIP_PADDING)
  )
  y = Math.max(
    TOOLTIP_PADDING,
    Math.min(y, viewportHeight - overlayH - TOOLTIP_PADDING)
  )

  return { x, y }
}

function computeCrossAxisX(
  triggerRect: DOMRect,
  overlayW: number,
  secondary: string | undefined
): number {
  if (secondary === "start" || secondary === "left") {
    return triggerRect.left
  }
  if (secondary === "end" || secondary === "right") {
    return triggerRect.right - overlayW
  }
  return triggerRect.left + triggerRect.width / 2 - overlayW / 2
}

function computeCrossAxisY(
  triggerRect: DOMRect,
  overlayH: number,
  secondary: string | undefined
): number {
  if (secondary === "top" || secondary === "start") {
    return triggerRect.top
  }
  if (secondary === "bottom" || secondary === "end") {
    return triggerRect.bottom - overlayH
  }
  return triggerRect.top + triggerRect.height / 2 - overlayH / 2
}

interface TooltipContentAreaProps {
  className: string
  testId: string
  placement: RAPlacement
  children: ReactNode
}

/**
 * TooltipContentArea renders the styled tooltip content and handles positioning.
 *
 * Positioning strategy: React Aria's useOverlayPosition sets inline left/top
 * values that compound on each re-render in Streamlit's DOM (the calculated
 * position doubles with each StrictMode or ResizeObserver re-run). We bypass
 * this entirely with CSS `left: 0 !important; top: 0 !important` on the overlay
 * and apply the correct position via `transform: translate(X, Y)` here, computed
 * from getBoundingClientRect() on the trigger. This is immune to:
 *   - StrictMode double-effects (same trigger rect → same result each run)
 *   - ResizeObserver cascades (transform persists through React re-renders)
 *   - CSS transform ancestors in Streamlit's DOM
 *
 * Interactive content: onPointerEnter/Leave keep the tooltip open while hovering
 * interactive content like code blocks with copy buttons.
 */
function TooltipContentArea({
  className,
  testId,
  placement,
  children,
}: TooltipContentAreaProps): ReactElement {
  const state = useContext(TooltipTriggerStateContext)
  const triggerRef = useContext(TriggerRefContext)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { innerWidth: viewportWidth, innerHeight: viewportHeight } =
    useWindowDimensionsContext()

  // Stable ref so applyPosition always calls close() on the latest state
  // without adding state to the useLayoutEffect deps (which would re-attach
  // the scroll listener whenever the context object identity changes).
  const stateRef = useRef(state)
  stateRef.current = state

  useLayoutEffect(() => {
    const triggerEl = triggerRef.current
    const overlayEl = wrapperRef.current?.closest(
      '[role="tooltip"]'
    ) as HTMLElement | null
    if (!triggerEl || !overlayEl) return

    const applyPosition = (): void => {
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access
      const triggerRect = triggerEl.getBoundingClientRect()

      // Close the tooltip if the trigger has scrolled fully out of the viewport.
      // Without this, our clamping logic keeps the tooltip pinned at the viewport
      // edge (e.g. y=8px) even after the trigger is no longer visible.
      if (
        triggerRect.bottom < 0 ||
        triggerRect.top > viewportHeight ||
        triggerRect.right < 0 ||
        triggerRect.left > viewportWidth
      ) {
        stateRef.current?.close()
        return
      }

      // Measure the CONTENT WRAPPER (wrapperRef) rather than the outer portal
      // element (overlayEl). React Aria resets the portal's maxHeight to '100vh'
      // between StrictMode double-invocations, inflating overlayEl.offsetHeight to
      // the CSS max-height resolved value (e.g. 18.75rem → 353px at the user's
      // browser font size). The content wrapper's CSS max-height caps it at the
      // true visual height, giving a stable measurement across both runs.
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access
      const W = wrapperRef.current?.offsetWidth ?? overlayEl.offsetWidth
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access
      const H = wrapperRef.current?.offsetHeight ?? overlayEl.offsetHeight
      const { x, y } = computeTooltipTransform(
        triggerRect,
        W,
        H,
        placement,
        viewportWidth,
        viewportHeight
      )
      overlayEl.style.transform = `translate(${x}px, ${y}px)`
    }

    applyPosition()
    // Reapply after a frame to capture the overlay's final rendered size.
    const raf = requestAnimationFrame(applyPosition)

    // Recompute on scroll: getBoundingClientRect() is viewport-relative, so the
    // trigger's coordinates change when the page scrolls.
    window.addEventListener("scroll", applyPosition, {
      passive: true,
      capture: true,
    })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", applyPosition, { capture: true })
    }
  }, [placement, triggerRef, viewportWidth, viewportHeight])

  return (
    <StyledTooltipContentWrapper
      ref={wrapperRef}
      className={className}
      data-testid={testId}
      onPointerEnter={() => state?.open(true)}
      onPointerLeave={() => state?.close()}
    >
      {children}
    </StyledTooltipContentWrapper>
  )
}

interface TriggerAreaProps {
  tag: "div" | "span"
  style: CSSProperties
  testId: string
  className: string
  children: ReactNode
}

/**
 * TriggerArea renders the hoverable/focusable wrapper that activates the tooltip.
 *
 * It combines two event-routing strategies:
 *
 * 1. `useFocusable`: reads hover/focus event handlers from the FocusableContext
 *    that TooltipTrigger provides (via FocusableProvider) and merges them onto
 *    the DOM element. This routes onPointerEnter/Leave to the tooltip state.
 *
 * 2. `useFocusWithin`: opens/closes the tooltip when any descendant receives
 *    or loses focus. React Aria's useFocus has a `target === currentTarget`
 *    guard, so the triggerProps.onFocus injected via FocusableContext only
 *    fires when the wrapper itself is the focused element — it never fires
 *    when a child button is tabbed to. useFocusWithin bypasses that guard by
 *    listening to the native focusin/focusout events (which bubble) and
 *    calling state.open/close directly via TooltipTriggerStateContext.
 */
function TriggerArea({
  tag: Tag,
  style,
  testId,
  className,
  children,
}: TriggerAreaProps): ReactElement {
  const state = useContext(TooltipTriggerStateContext)
  const triggerRef = useContext(TriggerRefContext)

  const { focusableProps } = useFocusable(
    { excludeFromTabOrder: true },
    triggerRef as MutableRefObject<HTMLElement | null>
  )

  const { focusWithinProps } = useFocusWithin({
    onFocusWithin() {
      state?.open(false)
    },
    onBlurWithin() {
      state?.close(true)
    },
  })

  return (
    <Tag
      ref={triggerRef as Ref<HTMLDivElement>}
      style={style}
      data-testid={testId}
      className={className}
      {...focusableProps}
      {...focusWithinProps}
    >
      {children}
    </Tag>
  )
}

function Tooltip({
  content,
  placement,
  children,
  inline,
  style,
  onMouseEnterDelay,
  containerWidth,
  error,
}: TooltipProps): ReactElement {
  const triggerRef = useRef<Element | null>(null)
  const raPlacement = REACT_ARIA_PLACEMENT[placement]

  return (
    <TriggerRefContext.Provider value={triggerRef}>
      <TooltipTrigger
        delay={onMouseEnterDelay ?? 200}
        closeDelay={300}
        isDisabled={!content}
      >
        <TriggerArea
          tag={inline ? "span" : "div"}
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: inline ? "flex-end" : "",
            width: containerWidth ? "100%" : "auto",
            ...style,
          }}
          testId={error ? "stTooltipErrorHoverTarget" : "stTooltipHoverTarget"}
          className={
            error ? "stTooltipErrorHoverTarget" : "stTooltipHoverTarget"
          }
        >
          {children}
        </TriggerArea>
        <StyledTooltip
          placement={raPlacement}
          offset={10}
          shouldFlip
          containerPadding={8}
        >
          <TooltipContentArea
            className={error ? "stTooltipErrorContent" : "stTooltipContent"}
            testId={error ? "stTooltipErrorContent" : "stTooltipContent"}
            placement={raPlacement}
          >
            {content}
          </TooltipContentArea>
        </StyledTooltip>
      </TooltipTrigger>
    </TriggerRefContext.Provider>
  )
}

export default memo(Tooltip)
