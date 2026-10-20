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
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
} from "react"

import {
  type Placement as FloatingPlacement,
  FloatingPortal,
  hide,
} from "@floating-ui/react"
import { useFocusWithin } from "react-aria"
// isFocusVisible has no public export. This private path is the module React
// Aria's FocusScope and tooltip already use, so they share one modality state.
import { isFocusVisible } from "react-aria/private/interactions/useFocusVisible"
import { TooltipTriggerStateContext } from "react-aria-components"
import { useTooltipTriggerState } from "react-stately"

import { FLOATING_OVERLAY_PORTAL_ID } from "~lib/components/core/Portal/constants"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"

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

/** Maps Streamlit's Placement enum to Floating UI placement strings. */
const FLOATING_UI_PLACEMENT: Record<Placement, FloatingPlacement> = {
  [Placement.AUTO]: "top",
  [Placement.TOP]: "top",
  [Placement.TOP_LEFT]: "top-start",
  [Placement.TOP_RIGHT]: "top-end",
  [Placement.BOTTOM]: "bottom",
  [Placement.BOTTOM_LEFT]: "bottom-start",
  [Placement.BOTTOM_RIGHT]: "bottom-end",
  [Placement.LEFT]: "left",
  [Placement.LEFT_TOP]: "left-start",
  [Placement.LEFT_BOTTOM]: "left-end",
  [Placement.RIGHT]: "right",
  [Placement.RIGHT_TOP]: "right-start",
  [Placement.RIGHT_BOTTOM]: "right-end",
}

export interface TooltipProps {
  content: ReactNode
  placement: Placement
  children: ReactNode
  inline?: boolean
  style?: CSSProperties
  onMouseEnterDelay?: number
  closeDelay?: number
  containerWidth?: boolean
  constrainWidth?: boolean
  error?: boolean
  dismissOnClick?: boolean
  interactive?: boolean
}

/** Shared ref to the trigger's DOM element, readable inside the tooltip portal. */
const TriggerRefContext = createContext<MutableRefObject<Element | null>>({
  current: null,
})
TriggerRefContext.displayName = "TriggerRefContext"

/** Callback ref context — TriggerArea calls this to register the DOM node. */
const SetTriggerRefContext = createContext<
  ((node: Element | null) => void) | null
>(null)
SetTriggerRefContext.displayName = "SetTriggerRefContext"

const HIDE_MIDDLEWARE = [hide({ strategy: "referenceHidden" })]

interface TriggerAreaProps {
  tag: "div" | "span"
  style: CSSProperties
  testId: string
  className: string
  ariaDescribedBy: string | undefined
  disabled: boolean
  dismissOnClick: boolean
  closeImmediatelyOnPointerLeave: boolean
  children: ReactNode
}

/**
 * TriggerArea renders the hoverable/focusable wrapper that activates the tooltip.
 *
 * Hover: onPointerEnter/Leave call state.open(false)/close(false) which use the
 * delay configured on useTooltipTriggerState.
 *
 * Focus: useFocusWithin closes the tooltip when focus leaves the trigger. When
 * focus enters, it opens the tooltip immediately only if:
 * - React Aria reports visible focus (keyboard or screen reader, including a
 *   dialog restoring focus after Escape), or
 * - a touch tap on the trigger moved focus there.
 * Like React Aria's useTooltipTrigger, focus from a mouse click, or restored
 * after a mouse close, leaves the tooltip to hover.
 *
 * onPointerLeave does not close a tooltip that focus opened. This keeps a
 * keyboard user's tooltip open when a mouse passes over the trigger, and keeps
 * a tapped tooltip open when the touch pointer leaves on release.
 */
function TriggerArea({
  tag: Tag,
  style,
  testId,
  className,
  ariaDescribedBy,
  disabled,
  dismissOnClick,
  closeImmediatelyOnPointerLeave,
  children,
}: TriggerAreaProps): ReactElement {
  const state = useContext(TooltipTriggerStateContext)
  const triggerRef = useContext(TriggerRefContext)
  const setTriggerRef = useContext(SetTriggerRefContext)
  /** True when keyboard, screen reader, or touch focus keeps the tooltip open. */
  const isHeldOpenByFocusRef = useRef(false)
  /**
   * Pointer type of the current press on this trigger. Tells a touch tap's focus
   * apart from a later focus restore. Cleared on click, pointercancel, and blur.
   */
  const pointerDownTypeRef = useRef<string | null>(null)

  const mergedRef = useCallback(
    (node: HTMLDivElement | null): void => {
      triggerRef.current = node
      setTriggerRef?.(node)
    },
    [triggerRef, setTriggerRef]
  )

  const { focusWithinProps } = useFocusWithin({
    onFocusWithin() {
      // isFocusVisible() is false after a touch tap, so check this trigger's
      // own pointerdown. React Aria's global pointer type won't do: a tap on a
      // dialog's close button also sets it.
      isHeldOpenByFocusRef.current =
        !disabled &&
        (isFocusVisible() || pointerDownTypeRef.current === "touch")
      if (isHeldOpenByFocusRef.current) state?.open(true)
    },
    onBlurWithin() {
      isHeldOpenByFocusRef.current = false
      pointerDownTypeRef.current = null
      state?.close(true)
    },
  })

  return (
    <Tag
      ref={mergedRef}
      style={style}
      data-testid={testId}
      className={className}
      aria-describedby={ariaDescribedBy}
      onPointerEnter={() => {
        if (!disabled) state?.open(false)
      }}
      onPointerLeave={() => {
        if (!isHeldOpenByFocusRef.current) {
          state?.close(closeImmediatelyOnPointerLeave)
        }
      }}
      onPointerDownCapture={e => {
        // Capture phase, because React Aria press handlers in children stop
        // pointerdown propagation.
        pointerDownTypeRef.current = e.pointerType
      }}
      onPointerCancelCapture={() => {
        pointerDownTypeRef.current = null
      }}
      onClickCapture={() => {
        // A tap focuses the trigger before its click, so onFocusWithin has
        // already read the pointer type. A WebKit tap doesn't focus the button,
        // and this clear stops a later focus restore from counting as that tap.
        pointerDownTypeRef.current = null
        if (dismissOnClick) {
          state?.close(true)
        }
      }}
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
  closeDelay,
  containerWidth,
  constrainWidth,
  error,
  dismissOnClick = false,
  interactive = true,
}: TooltipProps): ReactElement {
  const triggerRef = useRef<Element | null>(null)
  const tooltipId = useId()

  const state = useTooltipTriggerState({
    delay: onMouseEnterDelay ?? 200,
    closeDelay: closeDelay ?? 300,
  })
  const isDisabled = !content

  // Stable ref so effects always call close() on the latest state without
  // re-subscribing listeners on every render (useTooltipTriggerState returns
  // a new object reference each render).
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (isDisabled) {
      stateRef.current.close(true)
    }
  }, [isDisabled])

  // Floating UI owns positioning and scroll-tracking. The tooltip is portaled
  // into the shared overlay host so overflow or transform ancestors cannot
  // clip it, and so an open dialog does not mark it inert.
  const { floatingStyles, middlewareData, setFloating, setReference } =
    useFloatingOverlay({
      open: state.isOpen,
      placement: FLOATING_UI_PLACEMENT[placement],
      offsetPx: 10,
      extraMiddleware: HIDE_MIDDLEWARE,
    })

  // Close tooltip when trigger scrolls out of view (hide middleware detects this).
  // Guard against zero-size rects (e.g. JSDOM) where referenceHidden is always
  // true because the reference has no layout.
  const referenceHidden = middlewareData.hide?.referenceHidden ?? false
  useEffect(() => {
    if (referenceHidden && triggerRef.current) {
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access
      const rect = triggerRef.current.getBoundingClientRect()
      if (rect.width > 0 || rect.height > 0) {
        stateRef.current.close(true)
      }
    }
  }, [referenceHidden])

  // Callback ref that TriggerArea calls to register the trigger DOM node with
  // both the local triggerRef (for referenceHidden check) and Floating UI.
  const setReferenceRef = useCallback(
    (node: Element | null): void => {
      setReference(node)
      triggerRef.current = node
    },
    [setReference]
  )

  // Close the tooltip on Escape without stopping event propagation.
  // React Aria's useTooltipTrigger would register a document capture listener
  // that calls stopPropagation(), preventing other handlers (e.g. textarea
  // onKeyDown inside glide-data-grid) from ever seeing the Escape event.
  // By managing state ourselves, we avoid that behavior entirely.
  useEffect(() => {
    if (!state.isOpen) return

    const onEscape = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        stateRef.current.close(true)
      }
    }

    document.addEventListener("keydown", onEscape, true)
    return () => document.removeEventListener("keydown", onEscape, true)
  }, [state.isOpen])

  return (
    <TooltipTriggerStateContext.Provider value={state}>
      <TriggerRefContext.Provider value={triggerRef}>
        <SetTriggerRefContext.Provider value={setReferenceRef}>
          <TriggerArea
            tag={inline ? "span" : "div"}
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: inline ? "flex-end" : "",
              width: containerWidth ? "100%" : "auto",
              // Opt-in: cap and allow shrinking so a flex-item trigger
              // (e.g. badge+help) can ellipsize instead of growing to content.
              ...(constrainWidth
                ? { maxWidth: "100%", minWidth: 0 }
                : undefined),
              ...style,
            }}
            testId={
              error ? "stTooltipErrorHoverTarget" : "stTooltipHoverTarget"
            }
            className={
              error ? "stTooltipErrorHoverTarget" : "stTooltipHoverTarget"
            }
            ariaDescribedBy={
              !isDisabled && state.isOpen ? tooltipId : undefined
            }
            disabled={isDisabled}
            dismissOnClick={dismissOnClick}
            closeImmediatelyOnPointerLeave={closeDelay === 0}
          >
            {children}
          </TriggerArea>
          {/*
            Disable FloatingPortal's tab-order guards. They set tabindex="-1"
            on portal content whenever focus leaves it, which would strip
            links in help text out of the tab order.
          */}
          {!isDisabled && state.isOpen ? (
            <FloatingPortal
              id={FLOATING_OVERLAY_PORTAL_ID}
              preserveTabOrder={false}
            >
              <StyledTooltip
                ref={setFloating}
                id={tooltipId}
                role="tooltip"
                style={floatingStyles}
              >
                <StyledTooltipContentWrapper
                  className={
                    error ? "stTooltipErrorContent" : "stTooltipContent"
                  }
                  data-testid={
                    error ? "stTooltipErrorContent" : "stTooltipContent"
                  }
                  onPointerEnter={() => {
                    if (interactive) {
                      state.open(true)
                    }
                  }}
                  onPointerLeave={() => state.close(!interactive)}
                >
                  {content}
                </StyledTooltipContentWrapper>
              </StyledTooltip>
            </FloatingPortal>
          ) : null}
        </SetTriggerRefContext.Provider>
      </TriggerRefContext.Provider>
    </TooltipTriggerStateContext.Provider>
  )
}

export default memo(Tooltip)
