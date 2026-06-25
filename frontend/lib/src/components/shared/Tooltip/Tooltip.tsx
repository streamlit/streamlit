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
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react"

import { type Placement as FloatingPlacement, hide } from "@floating-ui/react"
import { useFocusWithin } from "react-aria"
import {
  type ContextValue,
  type Placement as RAPlacement,
  type TooltipProps as RATooltipProps,
  TooltipContext,
  TooltipTriggerStateContext,
} from "react-aria-components"
import { useTooltipTriggerState } from "react-stately"

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

/**
 * Maps Streamlit's Placement enum to React Aria placement strings.
 * Still needed because RAC's <Tooltip> uses placement to set data-placement.
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
  containerWidth?: boolean
  error?: boolean
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
  children: ReactNode
}

/**
 * TriggerArea renders the hoverable/focusable wrapper that activates the tooltip.
 *
 * Hover: onPointerEnter/Leave call state.open(false)/close(false) which use the
 * delay configured on useTooltipTriggerState.
 *
 * Focus: useFocusWithin opens/closes the tooltip immediately when any descendant
 * receives or loses focus (bubbling focusin/focusout under the hood).
 *
 * onPointerLeave only closes the tooltip if focus is not currently held within
 * the trigger. This prevents a keyboard user's tooltip from dismissing when a
 * mouse passes over and leaves the trigger area while focus is still held,
 * regardless of whether focus or hover came first.
 */
function TriggerArea({
  tag: Tag,
  style,
  testId,
  className,
  ariaDescribedBy,
  disabled,
  children,
}: TriggerAreaProps): ReactElement {
  const state = useContext(TooltipTriggerStateContext)
  const triggerRef = useContext(TriggerRefContext)
  const setTriggerRef = useContext(SetTriggerRefContext)
  const hasFocusWithinRef = useRef(false)

  const mergedRef = useCallback(
    (node: HTMLDivElement | null): void => {
      triggerRef.current = node
      setTriggerRef?.(node)
    },
    [triggerRef, setTriggerRef]
  )

  const { focusWithinProps } = useFocusWithin({
    onFocusWithin() {
      hasFocusWithinRef.current = true
      if (!disabled) state?.open(true)
    },
    onBlurWithin() {
      hasFocusWithinRef.current = false
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
        if (!hasFocusWithinRef.current) {
          state?.close(false)
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
  containerWidth,
  error,
}: TooltipProps): ReactElement {
  const triggerRef = useRef<Element | null>(null)
  // Always-null ref passed to RAC's TooltipContext so its internal
  // useOverlayPosition has no target and won't fight Floating UI.
  const nullTriggerRef = useRef<Element | null>(null)
  const raPlacement = REACT_ARIA_PLACEMENT[placement]
  const tooltipId = useId()

  const state = useTooltipTriggerState({
    delay: onMouseEnterDelay ?? 200,
    closeDelay: 300,
  })

  // Stable ref so effects always call close() on the latest state without
  // re-subscribing listeners on every render (useTooltipTriggerState returns
  // a new object reference each render).
  const stateRef = useRef(state)
  stateRef.current = state

  // Floating UI provides scroll-tracking via autoUpdate. RAC's <Tooltip> is
  // kept for its portal, role="tooltip", and aria-hidden management. Its
  // imperative positioning is overridden via CSS !important (see
  // styled-components.tsx) and Floating UI's floatingStyles applied via style prop.
  const { refs, floatingStyles, middlewareData } = useFloatingOverlay({
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
      refs.setReference(node)
      triggerRef.current = node
    },
    [refs]
  )

  const tooltipContextValue = useMemo(
    () =>
      ({
        triggerRef: nullTriggerRef,
      }) as ContextValue<RATooltipProps, HTMLDivElement>,
    [nullTriggerRef]
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
          <TooltipContext.Provider value={tooltipContextValue}>
            <TriggerArea
              tag={inline ? "span" : "div"}
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: inline ? "flex-end" : "",
                width: containerWidth ? "100%" : "auto",
                ...style,
              }}
              testId={
                error ? "stTooltipErrorHoverTarget" : "stTooltipHoverTarget"
              }
              className={
                error ? "stTooltipErrorHoverTarget" : "stTooltipHoverTarget"
              }
              ariaDescribedBy={state.isOpen ? tooltipId : undefined}
              disabled={!content}
            >
              {children}
            </TriggerArea>
            {content ? (
              <StyledTooltip
                ref={refs.setFloating}
                id={tooltipId}
                placement={raPlacement}
                style={floatingStyles}
              >
                <StyledTooltipContentWrapper
                  className={
                    error ? "stTooltipErrorContent" : "stTooltipContent"
                  }
                  data-testid={
                    error ? "stTooltipErrorContent" : "stTooltipContent"
                  }
                  onPointerEnter={() => state?.open(true)}
                  onPointerLeave={() => state?.close()}
                >
                  {content}
                </StyledTooltipContentWrapper>
              </StyledTooltip>
            ) : null}
          </TooltipContext.Provider>
        </SetTriggerRefContext.Provider>
      </TriggerRefContext.Provider>
    </TooltipTriggerStateContext.Provider>
  )
}

export default memo(Tooltip)
