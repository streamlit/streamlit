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
  memo,
  type ReactElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { FloatingPortal, type Middleware, size } from "@floating-ui/react"
import { flushSync } from "react-dom"

import type { Block as BlockProto } from "@streamlit/protobuf"
import { notNullOrUndefined } from "@streamlit/utils"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import { FLOATING_OVERLAY_PORTAL_ID } from "~lib/components/core/Portal/constants"
import { Box } from "~lib/components/shared/Base/styled-components"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "~lib/components/shared/BaseButton/BaseButton"
import { BaseButtonTooltip } from "~lib/components/shared/BaseButton/BaseButtonTooltip"
import { DynamicButtonLabel } from "~lib/components/shared/BaseButton/DynamicButtonLabel"
import { useResolvedWrap } from "~lib/components/shared/BaseButton/useResolvedWrap"
import {
  DynamicIcon,
  isMenuStyleIconLabel,
} from "~lib/components/shared/Icon/DynamicIcon"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import {
  SHIFT_VIEWPORT_PADDING,
  useFloatingOverlay,
} from "~lib/hooks/useFloatingOverlay"
import useTimeout from "~lib/hooks/useTimeout"
import useWidgetManagerElementState from "~lib/hooks/useWidgetManagerElementState"
import { convertRemToPx } from "~lib/theme/utils"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledPopoverBody,
  StyledPopoverExpansionIcon,
  StyledPopoverLabelContainer,
} from "./styled-components"

/**
 * Fit the popover inside the available space without exceeding the design caps,
 * and stop CSS `min-width` from defeating that.
 *
 * `designMaxWidthPx` and `cssMinWidthPx` mirror StyledPopoverBody; see the call
 * site for how they are derived.
 */
export function clampPopoverSize({
  availableWidth,
  availableHeight,
  designMaxWidthPx,
  cssMinWidthPx,
}: {
  availableWidth: number
  availableHeight: number
  designMaxWidthPx: number
  cssMinWidthPx: number
}): { maxWidth: string; maxHeight: string; minWidth: string } {
  const maxWidthPx = Math.min(
    Math.max(Math.floor(availableWidth), 0),
    designMaxWidthPx
  )
  return {
    maxWidth: `${maxWidthPx}px`,
    maxHeight: `min(${Math.max(Math.floor(availableHeight), 0)}px, 70vh)`,
    // CSS prefers min-width over max-width when they conflict, so lower it.
    // Compared against the capped width, not the raw available space, so a
    // stretch popover sized between the design cap and the viewport is caught.
    minWidth: cssMinWidthPx > maxWidthPx ? `${maxWidthPx}px` : "",
  }
}

export interface PopoverProps {
  element: BlockProto.Popover
  empty: boolean
  stretchWidth: boolean
  widgetMgr: WidgetStateManager
  /** Block-level ID for CSS key styling and passive persistence. */
  blockId?: string
  fragmentId?: string
}

/**
 * Attributes that can hide the trigger. A mutation only wakes the
 * observer; `isPopoverTriggerHidden` decides whether to close.
 */
const TRIGGER_VISIBILITY_ATTRIBUTES = [
  "inert",
  "class",
  "style",
  "hidden",
  "open",
]

/**
 * Whether `trigger` is hidden from the user.
 *
 * - `checkVisibility()` catches `display: none` (inactive tabs) and ignores `inert`.
 * - Expander collapse sets `inert` on the panel inside `<details>` before the
 *   height animation finishes, so that `inert` counts as hidden.
 * - Dialog `inert` sits on an ancestor outside `<details>` and leaves the popover open.
 * - Without `checkVisibility` (for example jsdom or older Safari), fall back
 *   to computed `display: none` on the trigger or an ancestor.
 */
function isPopoverTriggerHidden(trigger: HTMLElement): boolean {
  // `closest` returns the nearest inert ancestor. Only an inert host inside
  // `<details>` is a collapsed expander.
  const inertHost = trigger.closest("[inert]")
  if (inertHost?.closest("details")) {
    return true
  }
  if (trigger.closest("[hidden]") !== null) {
    return true
  }
  if (typeof trigger.checkVisibility === "function") {
    return !trigger.checkVisibility()
  }
  return hasDisplayNone(trigger)
}

/**
 * `display: none` on `trigger` or an ancestor. Used where `checkVisibility`
 * is missing. jsdom's client rects are empty for every element, so they
 * cannot stand in for this check.
 */
function hasDisplayNone(trigger: HTMLElement): boolean {
  let node: HTMLElement | null = trigger
  while (node) {
    if (getComputedStyle(node).display === "none") {
      return true
    }
    node = node.parentElement
  }
  return false
}

/** Blur a focused widget in the body so its value commits before unmount. */
function blurFocusedPopoverDescendant(
  body: HTMLElement | null,
  fromLayout = false
): void {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !body?.contains(active)) {
    return
  }
  // A layout effect already flushes updates it schedules. flushSync there
  // warns and does not flush.
  if (fromLayout) {
    active.blur()
    return
  }
  /* eslint-disable-next-line @eslint-react/dom-no-flush-sync --
   * Flush the widget's blur commit before the body unmounts.
   */
  flushSync(() => {
    active.blur()
  })
}

const Popover: React.FC<React.PropsWithChildren<PopoverProps>> = ({
  element,
  empty,
  children,
  stretchWidth,
  widgetMgr,
  blockId,
  fragmentId,
}): ReactElement => {
  const theme = useEmotionTheme()
  const isInSidebar = useContext(IsSidebarContext)

  // id is only set when the backend registers the popover as a
  // stateful widget (on_change="rerun").
  const widgetId = element.id
  const isWidget = Boolean(widgetId)
  const isPassivelyKeyed = Boolean(blockId) && !isWidget

  // Persist open state across remounts via elementStates.
  // The hook is always called (Rules of Hooks) but only effective when
  // isPassivelyKeyed — otherwise the empty id produces a no-op entry.
  const [storedOpen, setStoredOpen] = useWidgetManagerElementState<boolean>({
    widgetMgr,
    id: isPassivelyKeyed ? (blockId ?? "") : "",
    key: "open",
    defaultValue: element.open ?? false,
  })

  const initialOpen = isPassivelyKeyed ? storedOpen : (element.open ?? false)

  // Single state with optimistic updates for instant UI feedback.
  const [open, setOpen] = useState(initialOpen)

  // Sync backend state changes (for programmatic control via session_state).
  // Uses render-time comparison instead of useEffect — no DOM side effects needed.
  useExecuteWhenChanged(() => {
    if (!widgetId || !notNullOrUndefined(element.open)) {
      return
    }
    setOpen(element.open)
    // Also update the widget manager so the frontend sends the correct value
    // on subsequent reruns. Without this, a programmatic close (e.g.
    // st.session_state.key = False) would leave a stale "true" in the widget
    // state, causing the popover to reopen when another widget triggers a rerun.
    widgetMgr?.setBoolValue(widgetId, element.open, {
      formId: undefined,
      fragmentId,
      fromUser: false,
    })
  }, [widgetId, element.open])

  // Measure the trigger container's width so the portalled popover body can
  // match it when stretchWidth is true. A ResizeObserver is required because
  // the popover is portalled to document.body (no CSS parent-child sizing).
  const { width: calculatedWidth, elementRef } = useCalculatedDimensions()

  // When wrap resolves to no-wrap, reveal the full label on hover via a native
  // title, skipped when help is set since help provides the tooltip.
  const wrap = useResolvedWrap(element.wrap)
  const addTitleTooltip = !wrap && !element.help

  // Timestamp of the last open. The outside-click handler ignores a click in
  // that same moment. A press that reveals a withheld body is tracked
  // separately, because that click can arrive long after pointerdown.
  const openedAtRef = useRef(0)
  const userOpenedRef = useRef(false)

  // Handle popover toggle with optimistic updates
  const handleToggle = useCallback((): void => {
    const newOpen = !open

    if (newOpen) {
      openedAtRef.current = Date.now()
      // The trigger is on screen: the user just clicked it. A script-restored
      // open cannot say that, because a parent may still hide the trigger.
      userOpenedRef.current = true
    }

    setOpen(newOpen)

    if (widgetId) {
      widgetMgr?.setBoolValue(widgetId, newOpen, {
        formId: undefined,
        fragmentId,
        fromUser: true,
      })
    } else if (isPassivelyKeyed) {
      setStoredOpen(newOpen)
    }
  }, [open, widgetMgr, widgetId, fragmentId, isPassivelyKeyed, setStoredOpen])

  /**
   * Close the popover and record the closed state.
   *
   * Used for outside click, Escape, and a trigger that was shown and then
   * hidden. A backend-driven tab or expander change looks the same as a user
   * hide, so it records `fromUser: true` and may rerun. A trigger that has
   * never been shown is not closed here: writing `false` would still run
   * `on_change` on the next unrelated rerun.
   */
  const closePopover = useCallback((): void => {
    setOpen(false)

    if (widgetId) {
      widgetMgr?.setBoolValue(widgetId, false, {
        formId: undefined,
        fragmentId,
        fromUser: true,
      })
    } else if (isPassivelyKeyed) {
      // Passive popover (keyed but no on_change): persist the closed state
      // so it survives reruns triggered by other widgets, without a rerun.
      setStoredOpen(false)
    }
  }, [widgetMgr, widgetId, fragmentId, isPassivelyKeyed, setStoredOpen])

  let kind = BaseButtonKind.SECONDARY
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY
  }

  // Hide the chevron if the label is a menu-style icon (e.g., :material/menu:)
  const hideChevron = isMenuStyleIconLabel(element.icon, element.label)

  // Attach to a wrapper div rather than BaseButton directly. BaseButtonTooltip
  // renders children twice when `help` is set (normal + mobile), which causes
  // React to assign the ref to the hidden mobile copy. A single wrapper div
  // outside BaseButtonTooltip is always rendered once and correctly positioned.
  const triggerRef = useRef<HTMLDivElement>(null)

  const popoverBodyRef = useRef<HTMLDivElement>(null)

  // Records whether the most recent interaction (pointerdown, or Enter/Space
  // keydown) started inside the popover, its trigger, or a Streamlit overlay
  // root. We capture it in the capture phase because some overlays close
  // synchronously on selection (e.g. the date picker calendar and the
  // single-select dropdown), detaching the activated node from the DOM before
  // the follow-up `click` fires — at which point `e.target` is orphaned and
  // `closest(...)` can no longer find the overlay. Covers both mouse and
  // keyboard activation, which can dispatch a `click` with no prior pointerdown.
  const interactionInsideRef = useRef(false)

  // Keep the popover inside the viewport for narrow embeds (#9340) and
  // sidebar overflow clipping (#9387). Two middleware adjustments by scope:
  //
  // - **Always**: `size` clamps max-height/max-width to available space at the
  //   chosen placement, and lowers min-width when the CSS min would exceed
  //   that clamp.
  //   - Without the height clamp, a tall popover extends off-screen (#9387).
  //   - Without the width clamp, the ~704px design max-width overflows a
  //     narrow oEmbed iframe: `shift` pins one edge and the host clips the
  //     other (#9340).
  //   - `size` runs after `flip` so it measures against the final side;
  //     `StyledPopoverBody`'s `overflow: auto` scrolls when clamped.
  //
  // - **Sidebar only**: override the shift/flip `boundary` to
  //   `document.documentElement` so Floating UI uses the viewport, not the
  //   sidebar's `overflow: auto` rect. Prefer `<html>` over `document.body`
  //   because `.stApp`'s `position: absolute; inset: 0` leaves body at 0x0 —
  //   a body boundary would always report overflow. Without this override,
  //   shift squishes the popover against the sidebar edge.
  const overlayOptions = useMemo(() => {
    const base = {
      open,
      placement: "bottom-start" as const,
      offsetPx: convertRemToPx(theme.spacing.twoXS),
    }
    if (typeof document === "undefined") {
      return base
    }
    const boundary = document.documentElement
    // Mirrors StyledPopoverBody — keep in sync with styled-components.ts.
    // Reading these back from the DOM would force a style recomputation on
    // every position update. `contentMaxWidth` is a px token; `spacing.lg` is
    // rem — hence parseFloat vs convertRemToPx.
    const designMaxWidthPx =
      Number.parseFloat(theme.sizes.contentMaxWidth) -
      2 * convertRemToPx(theme.spacing.lg)
    const cssMinWidthPx = stretchWidth
      ? Math.max(calculatedWidth, convertRemToPx("10rem"))
      : convertRemToPx(theme.sizes.minPopupWidth)
    const sizeMiddleware: Middleware = size({
      padding: SHIFT_VIEWPORT_PADDING,
      boundary,
      apply({ availableHeight, availableWidth, elements }) {
        const { maxWidth, maxHeight, minWidth } = clampPopoverSize({
          availableWidth,
          availableHeight,
          designMaxWidthPx,
          cssMinWidthPx,
        })
        Object.assign(elements.floating.style, {
          maxWidth,
          maxHeight,
          minWidth,
        })
      },
    })
    if (!isInSidebar) {
      // Still apply `size` for narrow embeds, but skip the flip/shift boundary
      // override — defaults already use the viewport for `position: fixed`.
      return { ...base, extraMiddleware: [sizeMiddleware] }
    }
    return {
      ...base,
      flipOptions: { boundary },
      shiftOptions: { padding: SHIFT_VIEWPORT_PADDING, boundary },
      extraMiddleware: [sizeMiddleware],
    }
  }, [
    open,
    theme.spacing.twoXS,
    theme.spacing.lg,
    theme.sizes.minPopupWidth,
    theme.sizes.contentMaxWidth,
    isInSidebar,
    stretchWidth,
    calculatedWidth,
  ])

  // Floating UI provides scroll-tracking via autoUpdate. RAC's Popover is
  // fully replaced with FloatingPortal here because Popover has no collection
  // system dependency — it renders arbitrary children, not ComboBox items.
  const { refs, floatingStyles } = useFloatingOverlay(overlayOptions)

  // While this is true the popover is open but its trigger is hidden, so the
  // body stays unmounted. Start withheld: the first commit must not mount the
  // body before the layout effect knows whether the trigger is on screen.
  // Dismissal stays off too: a click or Escape on the visible page must not
  // close a popover the user has not seen.
  const [deferBody, setDeferBody] = useState(true)
  const deferBodyRef = useRef(true)
  // A press that began while the body was withheld. The click that ends it
  // must not dismiss the body that press revealed, even if the press is long.
  const pressStartedHiddenRef = useRef(false)
  const suppressRevealClickRef = useRef(false)
  const setBodyDeferred = useCallback((deferred: boolean): void => {
    if (deferBodyRef.current === deferred) return
    deferBodyRef.current = deferred
    setDeferBody(deferred)
  }, [])

  // Custom dismissal via document-level DOM listeners.
  //
  // The popover is portalled to document.body and uses isNonModal-style
  // rendering (no ariaHideOutside), so we implement outside-click and Escape
  // dismissal ourselves.
  //
  // We use `click` (not `pointerdown`) so that a focused input inside the
  // popover fires its blur/change handlers before we close, ensuring its
  // value is committed to Streamlit's widget state before the rerun.
  useEffect(() => {
    if (!open || deferBody) return

    // Reset on (re)open so a stale origin from a previous interaction — e.g. an
    // inside pointerdown followed by an Escape that never produced a click —
    // can't cause the next outside click to be misclassified as inside.
    interactionInsideRef.current = false

    // Do not dismiss when the click target belongs to this popover, its trigger,
    // or any Streamlit overlay (dropdowns, calendars, dataframe portals, and —
    // via `data-st-overlay-root` on the popover body — nested popovers). This
    // matches the modal dialog contract (see Modal's shouldCloseOnInteractOutside).
    const isInsidePopoverOrOverlay = (target: Node | null): boolean => {
      if (!target) return false
      const targetElement =
        target instanceof Element ? target : target.parentElement
      return Boolean(
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- a false hit still lets the popover body count
        triggerRef.current?.contains(target) ||
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- a false hit still lets an overlay target count
        popoverBodyRef.current?.contains(target) ||
        targetElement?.closest('[data-st-overlay-root="true"]')
      )
    }

    const handlePointerDown = (e: PointerEvent): void => {
      // A new press. A suppress left by a press that never clicked (a touch
      // that turned into a scroll) must not swallow this one.
      suppressRevealClickRef.current = false
      const inside = isInsidePopoverOrOverlay(e.target as Node)
      interactionInsideRef.current = inside
      // A tab click selects on pointerdown and can move focus before the
      // visibility observer runs. Blur while the widget is still focused.
      if (!inside) {
        blurFocusedPopoverDescendant(popoverBodyRef.current)
      }
    }

    const handleClick = (e: MouseEvent): void => {
      // The press that revealed a withheld body is still ending. That click
      // is what mounted this listener; it is not an outside dismiss.
      if (suppressRevealClickRef.current) {
        suppressRevealClickRef.current = false
        return
      }
      // In test environments (JSDOM), act() flushes useEffect synchronously,
      // so this listener can be live during the same click that opened the
      // popover. The timestamp guard prevents that click from closing it.
      if (Date.now() - openedAtRef.current < 50) return
      // Skip dismissal if the interaction started inside the popover/an overlay
      // (interactionInsideRef, captured before any select-and-close detaches the
      // node) or the click itself lands inside one.
      const skip =
        interactionInsideRef.current ||
        isInsidePopoverOrOverlay(e.target as Node)
      interactionInsideRef.current = false
      if (skip) return
      closePopover()
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        // If a widget inside the popover has an open sub-overlay (e.g.
        // selectbox dropdown, date picker), let it handle Escape first —
        // only the innermost overlay should close per ARIA pattern.
        const active = document.activeElement
        if (
          active &&
          popoverBodyRef.current?.contains(active) &&
          active.getAttribute("aria-expanded") === "true"
        ) {
          return
        }

        e.stopPropagation()
        e.preventDefault()
        closePopover()
        triggerRef.current?.querySelector<HTMLButtonElement>("button")?.focus()
        return
      }

      // Enter/Space can activate a close-on-select overlay option and dispatch
      // a follow-up `click` with no preceding pointerdown. Record the origin now
      // (capture phase) so that click isn't misread as an outside click once the
      // overlay has detached the activated option.
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        interactionInsideRef.current = isInsidePopoverOrOverlay(
          e.target as Node
        )
      }
    }

    const handlePointerCancel = (): void => {
      suppressRevealClickRef.current = false
    }

    // Capture phase so we record the target before an overlay's own handler
    // can select-and-close (which detaches the node).
    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("pointercancel", handlePointerCancel, true)
    document.addEventListener("click", handleClick)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("pointercancel", handlePointerCancel, true)
      document.removeEventListener("click", handleClick)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [open, deferBody, closePopover])

  // Remember a press that starts while the body is withheld. If that press
  // reveals the trigger, its click must not close the popover. A click that
  // leaves the trigger hidden clears the mark, so a later click still closes.
  useEffect(() => {
    if (!open || !deferBody) return

    const onPointerDown = (): void => {
      pressStartedHiddenRef.current = true
    }
    const onClick = (): void => {
      pressStartedHiddenRef.current = false
    }
    const onPointerCancel = (): void => {
      pressStartedHiddenRef.current = false
    }
    // pointerdown is capture so the mark is set before a tab's own
    // pointerdown reveals the trigger. The click clear is bubble so a
    // summary handler can reveal first and keep the mark.
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("pointercancel", onPointerCancel, true)
    document.addEventListener("click", onClick)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("pointercancel", onPointerCancel, true)
      document.removeEventListener("click", onClick)
    }
  }, [open, deferBody])

  // Whether the trigger has been visible during this open. A later hide
  // records a close only after that. Until then the body stays unmounted
  // and `open` is left unchanged.
  const seenRef = useRef(false)
  // True while a script-restored open waits for parent effects. Visible
  // readings in that window are ignored.
  const waitForParentRef = useRef(false)
  const applyVisibilityRef = useRef<() => void>(() => {})
  const visibilityTickRef = useRef(0)
  const restartVisibilityWaitRef = useRef<(delay?: number | null) => void>(
    () => {}
  )
  // Parent effects can still change visibility after this one. The first tick
  // is too early to trust; the second tick is the read. This wait is
  // best-effort: a timer and a parent effect are not ordered against each
  // other, so a busy thread can still mark the trigger seen first.
  const finishVisibilityWait = useCallback((): void => {
    if (visibilityTickRef.current === 0) {
      visibilityTickRef.current = 1
      restartVisibilityWaitRef.current(0)
      return
    }
    visibilityTickRef.current = 0
    waitForParentRef.current = false
    applyVisibilityRef.current()
  }, [])
  const { clear: clearVisibilityWait, restart: restartVisibilityWait } =
    useTimeout(finishVisibilityWait, 0, { autoStart: false })
  restartVisibilityWaitRef.current = restartVisibilityWait

  useLayoutEffect(() => {
    if (!open) {
      seenRef.current = false
      waitForParentRef.current = false
      userOpenedRef.current = false
      pressStartedHiddenRef.current = false
      suppressRevealClickRef.current = false
      setBodyDeferred(true)
      return
    }
    const trigger = triggerRef.current
    if (!trigger) return

    let cancelled = false
    if (userOpenedRef.current) {
      seenRef.current = true
    }
    userOpenedRef.current = false

    const apply = (fromLayout: boolean): void => {
      if (cancelled) return
      if (!isPopoverTriggerHidden(trigger)) {
        if (waitForParentRef.current) return
        // The press that reveals the trigger is still in progress. Its click
        // mounts the dismissal listener, so remember to ignore that click.
        if (deferBodyRef.current && pressStartedHiddenRef.current) {
          suppressRevealClickRef.current = true
        }
        pressStartedHiddenRef.current = false
        seenRef.current = true
        setBodyDeferred(false)
        return
      }
      if (seenRef.current) {
        blurFocusedPopoverDescendant(popoverBodyRef.current, fromLayout)
        // A layout effect already runs before paint. flushSync from inside it
        // is deferred and warns, so close directly on that path.
        if (fromLayout) {
          closePopover()
          return
        }
        /* eslint-disable-next-line @eslint-react/dom-no-flush-sync --
         * Unmount the portaled body before paint so it cannot sit on the corner.
         */
        flushSync(() => {
          closePopover()
        })
        return
      }
      setBodyDeferred(true)
    }
    applyVisibilityRef.current = () => {
      apply(false)
    }

    const observer = new MutationObserver(() => {
      apply(false)
    })
    let node: HTMLElement | null = trigger
    while (node) {
      observer.observe(node, {
        attributes: true,
        attributeFilter: TRIGGER_VISIBILITY_ATTRIBUTES,
      })
      node = node.parentElement
    }

    if (seenRef.current) {
      apply(true)
    } else {
      waitForParentRef.current = true
      visibilityTickRef.current = 0
      setBodyDeferred(true)
      restartVisibilityWait(0)
    }

    return () => {
      cancelled = true
      observer.disconnect()
      clearVisibilityWait()
    }
  }, [
    open,
    closePopover,
    setBodyDeferred,
    restartVisibilityWait,
    clearVisibilityWait,
  ])

  // Merge the floating ref with our local popoverBodyRef for dismissal logic.
  const setFloatingRef = useCallback(
    (node: HTMLDivElement | null): void => {
      refs.setFloating(node)
      ;(
        popoverBodyRef as React.MutableRefObject<HTMLDivElement | null>
      ).current = node
    },
    [refs]
  )

  // Merge the reference ref with our local triggerRef for dismissal logic.
  const setReferenceRef = useCallback(
    (node: HTMLDivElement | null): void => {
      refs.setReference(node)
      ;(triggerRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node
    },
    [refs]
  )

  return (
    <Box data-testid="stPopover" className="stPopover" ref={elementRef}>
      <div ref={setReferenceRef}>
        <BaseButtonTooltip help={element.help} containerWidth={true}>
          <BaseButton
            data-testid="stPopoverButton"
            kind={kind}
            size={BaseButtonSize.SMALL}
            disabled={(empty && !widgetId) || element.disabled}
            containerWidth={true}
            onClick={handleToggle}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <StyledPopoverLabelContainer
              $hideChevron={hideChevron}
              $truncate={!wrap}
            >
              <DynamicButtonLabel
                icon={element.icon}
                label={element.label}
                wrap={wrap}
                addTitleTooltip={addTitleTooltip}
              />
              {!hideChevron && (
                <StyledPopoverExpansionIcon aria-hidden="true">
                  <DynamicIcon
                    iconValue={
                      open
                        ? ":material/expand_less:"
                        : ":material/expand_more:"
                    }
                    size="base"
                  />
                </StyledPopoverExpansionIcon>
              )}
            </StyledPopoverLabelContainer>
          </BaseButton>
        </BaseButtonTooltip>
      </div>
      {open && !deferBody && (
        <FloatingPortal id={FLOATING_OVERLAY_PORTAL_ID}>
          <StyledPopoverBody
            ref={setFloatingRef}
            data-testid="stPopoverBody"
            // Marks the body as an overlay surface so a nested popover (or the
            // widget overlays inside it) doesn't dismiss an enclosing popover
            // whose dismissal logic checks this attribute.
            data-st-overlay-root="true"
            role="dialog"
            aria-label={element.label}
            style={floatingStyles}
            $stretchWidth={stretchWidth}
            $calculatedWidth={calculatedWidth}
          >
            {children}
          </StyledPopoverBody>
        </FloatingPortal>
      )}
    </Box>
  )
}

export default memo(Popover)
