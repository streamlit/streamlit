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
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { FloatingPortal } from "@floating-ui/react"

import { Block as BlockProto } from "@streamlit/protobuf"
import { notNullOrUndefined } from "@streamlit/utils"

import { Box } from "~lib/components/shared/Base/styled-components"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "~lib/components/shared/BaseButton/BaseButton"
import { BaseButtonTooltip } from "~lib/components/shared/BaseButton/BaseButtonTooltip"
import { DynamicButtonLabel } from "~lib/components/shared/BaseButton/DynamicButtonLabel"
import {
  DynamicIcon,
  isMenuStyleIconLabel,
} from "~lib/components/shared/Icon/DynamicIcon"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import useWidgetManagerElementState from "~lib/hooks/useWidgetManagerElementState"
import { convertRemToPx } from "~lib/theme/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledPopoverBody,
  StyledPopoverExpansionIcon,
  StyledPopoverLabelContainer,
} from "./styled-components"

export interface PopoverProps {
  element: BlockProto.Popover
  empty: boolean
  stretchWidth: boolean
  widgetMgr: WidgetStateManager
  /** Block-level ID for CSS key styling and passive persistence. */
  blockId?: string
  fragmentId?: string
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
    widgetMgr?.setBoolValue(
      { id: widgetId },
      element.open,
      { fromUi: false },
      fragmentId
    )
  }, [widgetId, element.open])

  // Measure the trigger container's width so the portalled popover body can
  // match it when stretchWidth is true. A ResizeObserver is required because
  // the popover is portalled to document.body (no CSS parent-child sizing).
  const { width: calculatedWidth, elementRef } = useCalculatedDimensions()

  // Timestamp of the last open action — used by the outside-click handler to
  // ignore clicks that occur in the same tick as opening. In production
  // browsers useEffect is async so the listener isn't live during the opening
  // click, but in JSDOM act() flushes synchronously within the same event.
  const openedAtRef = useRef(0)

  // Handle popover toggle with optimistic updates
  const handleToggle = useCallback((): void => {
    const newOpen = !open

    if (newOpen) {
      openedAtRef.current = Date.now()
    }

    setOpen(newOpen)

    if (widgetId) {
      widgetMgr?.setBoolValue(
        { id: widgetId },
        newOpen,
        { fromUi: true },
        fragmentId
      )
    } else if (isPassivelyKeyed) {
      setStoredOpen(newOpen)
    }
  }, [open, widgetMgr, widgetId, fragmentId, isPassivelyKeyed, setStoredOpen])

  const handleClose = useCallback((): void => {
    setOpen(false)

    if (widgetId) {
      widgetMgr?.setBoolValue(
        { id: widgetId },
        false,
        { fromUi: true },
        fragmentId
      )
    } else if (isPassivelyKeyed) {
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

  // Floating UI provides scroll-tracking via autoUpdate. RAC's Popover is
  // fully replaced with FloatingPortal here because Popover has no collection
  // system dependency — it renders arbitrary children, not ComboBox items.
  const { refs, floatingStyles } = useFloatingOverlay({
    open,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
  })

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
    if (!open) return

    const handleClick = (e: MouseEvent): void => {
      // In test environments (JSDOM), act() flushes useEffect synchronously,
      // so this listener can be live during the same click that opened the
      // popover. The timestamp guard prevents that click from closing it.
      if (Date.now() - openedAtRef.current < 50) return
      const target = e.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !popoverBodyRef.current?.contains(target)
      ) {
        handleClose()
      }
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
        handleClose()
        triggerRef.current?.querySelector<HTMLButtonElement>("button")?.focus()
      }
    }

    document.addEventListener("click", handleClick)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("click", handleClick)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [open, handleClose])

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
            <StyledPopoverLabelContainer $hideChevron={hideChevron}>
              <DynamicButtonLabel icon={element.icon} label={element.label} />
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
      {open && (
        <FloatingPortal>
          <StyledPopoverBody
            ref={setFloatingRef}
            data-testid="stPopoverBody"
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
