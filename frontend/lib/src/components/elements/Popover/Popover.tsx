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

  const { width: calculatedWidth, elementRef } = useCalculatedDimensions()

  // Handle popover toggle with optimistic updates
  const handleToggle = useCallback((): void => {
    const newOpen = !open

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

  // Ref for the popover body used in the outside-click handler below.
  const popoverBodyRef = useRef<HTMLDivElement>(null)

  // isNonModal disables React Aria's ariaHideOutside, which would otherwise
  // mark every element outside the popover as `inert`. In webkit (Safari),
  // `inert` fully prevents pointer events, making it impossible to click
  // anything on the page while the popover is open. isNonModal also skips
  // the position:fixed underlay div that independently causes the same webkit
  // blocking.
  //
  // Side-effect: with isNonModal=true, React Aria never auto-focuses the
  // overlay and never installs its own useInteractOutside or keyboard handlers.
  // We implement both outside-click and Escape-key dismissal ourselves.
  //
  // We use `click` (not `pointerdown`) so that a focused input inside the
  // popover fires its blur/change handlers before we call handleClose, ensuring
  // its value is committed to Streamlit's widget manager before the rerun.
  useEffect(() => {
    if (!open) return

    const handleClick = (e: MouseEvent): void => {
      const target = e.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !popoverBodyRef.current?.contains(target)
      ) {
        handleClose()
      }
    }

    // Capture phase: fires before any child handler, including React Aria's own
    // overlay onKeyDown. This prevents a double-close (our handler + React
    // Aria's) that would send two widget updates to the backend. The trade-off
    // is that nested overlays inside the popover (e.g. a Select dropdown) won't
    // get the first chance at Escape — pressing Escape always closes the
    // popover. This is acceptable given Streamlit's typical popover content.
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.stopPropagation()
        e.preventDefault()
        handleClose()
      }
    }

    // Defer by one tick so that the trigger click that opened the popover
    // finishes propagating before we begin watching for outside clicks.
    // Without this, in some chromium scenarios the opening click can race
    // with useEffect and be caught by our listener, immediately closing
    // the popover.
    const timerId = setTimeout(() => {
      document.addEventListener("click", handleClick)
      document.addEventListener("keydown", handleKeyDown, true)
    }, 0)

    return () => {
      clearTimeout(timerId)
      document.removeEventListener("click", handleClick)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [open, handleClose])

  return (
    <Box data-testid="stPopover" className="stPopover" ref={elementRef}>
      <div ref={triggerRef}>
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
      <StyledPopoverBody
        ref={popoverBodyRef}
        data-testid="stPopoverBody"
        isOpen={open}
        onOpenChange={(isOpen): void => {
          if (!isOpen) handleClose()
        }}
        triggerRef={triggerRef}
        placement="bottom left"
        offset={convertRemToPx(theme.spacing.twoXS)}
        containerPadding={convertRemToPx(theme.spacing.lg)}
        isNonModal
        $stretchWidth={stretchWidth}
        $calculatedWidth={calculatedWidth}
      >
        {children}
      </StyledPopoverBody>
    </Box>
  )
}

export default memo(Popover)
