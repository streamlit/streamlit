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

import { memo, ReactElement, useCallback, useEffect, useRef } from "react"

import { FloatingPortal } from "@floating-ui/react"

import {
  DynamicIcon,
  extractLeadingMaterialIcon,
} from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import { convertRemToPx } from "~lib/theme/utils"

import {
  StyledButtonActionMenuPanel,
  StyledMenuList,
  StyledMenuListItem,
} from "./styled-components"

/** Margin between the popover and its anchor element. */
const POPOVER_MARGIN = convertRemToPx("0.375rem")

interface ButtonActionMenuProps {
  /** The top position of the menu */
  top: number
  /** The left position of the menu */
  left: number
  /** The list of action labels to display */
  actions: string[]
  /** Callback when an action is selected */
  onSelectAction: (label: string) => void
  /** Callback to close the menu */
  onCloseMenu: () => void
}

/**
 * A dropdown menu for multi-action button cells.
 * Displays a list of actions and triggers a callback when one is selected.
 */
function ButtonActionMenu({
  top,
  left,
  actions,
  onSelectAction,
  onCloseMenu,
}: ButtonActionMenuProps): ReactElement {
  const { refs, floatingStyles } = useFloatingOverlay({
    open: true,
    placement: "bottom-end",
    offsetPx: POPOVER_MARGIN,
  })

  // Local ref for the panel — needed for click-outside detection and scroll-close.
  // Merged with floating-ui's ref via a callback ref.
  const panelRef = useRef<HTMLDivElement | null>(null)
  const setFloatingCallback = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node
      refs.setFloating(node)
    },
    [refs]
  )

  // Close menu on click outside or Escape key.
  // Both use the capture phase to match the ColumnMenu/ColumnVisibilityMenu pattern.
  useEffect(() => {
    function handlePointerDown(event: PointerEvent): void {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        // Let grid's button handler manage state for clicks on the menu target
        // (the invisible anchor element that positions this menu).
        if (
          (event.target as Element).closest(
            '[data-testid="stDataFrameButtonActionMenuTarget"]'
          )
        ) {
          return
        }
        onCloseMenu()
      }
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.stopPropagation()
        onCloseMenu()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [onCloseMenu])

  // Close menu on any scroll in the document (fixed positioning would misalign
  // with cell). The menu is rendered via FloatingPortal outside the dataframe's
  // DOM tree, so we cannot rely on ancestor containment checks — we must close
  // on any scroll except within the menu itself.
  useEffect(() => {
    function handleScroll(event: Event): void {
      // Ignore if the scroll is on the menu itself
      if (panelRef.current?.contains(event.target as Node)) {
        return
      }
      // Close on any scroll event outside the menu (including dataframe scroll,
      // window scroll, or any other scroll container)
      onCloseMenu()
    }

    document.addEventListener("scroll", handleScroll, { capture: true })
    // Wheel events on window can cause scroll without triggering scroll event
    // on elements with overflow: hidden
    window.addEventListener("wheel", handleScroll, { passive: true })

    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true })
      window.removeEventListener("wheel", handleScroll)
    }
  }, [onCloseMenu])

  const handleSelectAction = useCallback(
    (label: string) => {
      onSelectAction(label)
      onCloseMenu()
    },
    [onSelectAction, onCloseMenu]
  )

  const handleKeyDown = useCallback(
    (label: string) => (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        handleSelectAction(label)
      }
    },
    [handleSelectAction]
  )

  return (
    <>
      {/*
       * Invisible fixed-position div that serves as the floating-ui reference.
       * Its position (top/left from canvas coords) determines where the menu appears.
       */}
      <div
        ref={refs.setReference}
        data-testid="stDataFrameButtonActionMenuTarget"
        style={{
          position: "fixed",
          top,
          left,
          width: 0,
          height: 0,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      />
      <FloatingPortal>
        <StyledButtonActionMenuPanel
          ref={setFloatingCallback}
          style={floatingStyles}
          tabIndex={-1}
          data-testid="stDataFrameButtonActionMenu"
        >
          <StyledMenuList role="menu" aria-label="Button action menu">
            {actions.map((label, index) => {
              const { icon, text } = extractLeadingMaterialIcon(label)
              return (
                <StyledMenuListItem
                  // Index used to handle duplicate labels in user-provided data
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  key={`${label}-${index}`}
                  onClick={() => handleSelectAction(label)}
                  onKeyDown={handleKeyDown(label)}
                  role="menuitem"
                  tabIndex={0}
                  // Labels are user-provided and can be long, so allow wrapping
                  // instead of forcing a single line (which would overflow).
                  allowWrap
                  // Provide aria-label for icon-only menu items (where text is empty)
                  aria-label={text || icon || label}
                >
                  {icon && <DynamicIcon size="base" iconValue={icon} />}
                  <StreamlitMarkdown
                    source={text}
                    allowHTML={false}
                    isLabel
                    disableLinks
                  />
                </StyledMenuListItem>
              )
            })}
          </StyledMenuList>
        </StyledButtonActionMenuPanel>
      </FloatingPortal>
    </>
  )
}

export default memo(ButtonActionMenu)
