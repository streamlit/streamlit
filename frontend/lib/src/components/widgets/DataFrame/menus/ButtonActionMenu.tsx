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

import { memo, ReactElement, useCallback, useEffect } from "react"

import { FloatingPortal } from "@floating-ui/react"

import { DATAFRAME_PORTAL_ID } from "~lib/components/core/Portal/constants"
import {
  DynamicIcon,
  extractLeadingMaterialIcon,
} from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"

import {
  COLUMN_MENU_OFFSET,
  StyledButtonActionMenuPanel,
  StyledMenuList,
  StyledMenuListItem,
} from "./styled-components"

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
    offsetPx: COLUMN_MENU_OFFSET,
  })

  // panelRef is used by the scroll-close effect below to ignore scrolls inside the panel.
  const { panelRef, setFloatingRef } = useOverlayDismissal({
    isOpen: true,
    onClose: onCloseMenu,
    floatingSetFn: refs.setFloating,
    excludeSelectors: ['[data-testid="stDataFrameButtonActionMenuTarget"]'],
  })

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
  }, [onCloseMenu, panelRef])

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
      <FloatingPortal id={DATAFRAME_PORTAL_ID}>
        <StyledButtonActionMenuPanel
          ref={setFloatingRef}
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
