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
  KeyboardEvent,
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
} from "react"

import { ACCESSIBILITY_TYPE, PLACEMENT, Popover } from "baseui/popover"

import { getPopoverContainerStyle } from "~lib/components/shared/Base/styled-components"
import {
  DynamicIcon,
  extractLeadingMaterialIcon,
} from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme/utils"

import { StyledMenuList, StyledMenuListItem } from "./styled-components"

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
  const theme = useEmotionTheme()
  const { colors, fontSizes, fontWeights } = theme
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the menu when clicking outside. We use a global mousedown listener
  // because BaseWeb's onClickOutside doesn't work reliably with canvas elements
  // like glide-data-grid.
  useEffect(() => {
    function handleMouseDown(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onCloseMenu()
      }
    }

    // Use mousedown instead of click to close before other handlers fire
    document.addEventListener("mousedown", handleMouseDown)

    return () => {
      document.removeEventListener("mousedown", handleMouseDown)
    }
  }, [onCloseMenu])

  // Close the menu when scrolling occurs, since the fixed-position anchor
  // would become misaligned with the cell. This is more user-friendly than
  // blocking all page scrolling while the menu is open.
  useEffect(() => {
    function handleScroll(): void {
      onCloseMenu()
    }

    // Use capture phase to detect scroll before it propagates
    document.addEventListener("scroll", handleScroll, { capture: true })
    document.addEventListener("wheel", handleScroll, { passive: true })

    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true })
      document.removeEventListener("wheel", handleScroll)
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
    (label: string) => (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        handleSelectAction(label)
      }
    },
    [handleSelectAction]
  )

  return (
    <Popover
      aria-label="Button action menu"
      content={
        <StyledMenuList ref={menuRef} role="menu">
          {actions.map((label, index) => {
            const { icon, text } = extractLeadingMaterialIcon(label)
            return (
              <StyledMenuListItem
                // Index is intentionally used to handle duplicate labels in user-provided data
                // eslint-disable-next-line @eslint-react/no-array-index-key
                key={`${label}-${index}`}
                onClick={() => handleSelectAction(label)}
                onKeyDown={handleKeyDown(label)}
                role="menuitem"
                tabIndex={0}
              >
                {icon && <DynamicIcon size="base" iconValue={icon} />}
                <StreamlitMarkdown
                  source={text}
                  allowHTML={false}
                  isLabel
                  largerLabel={false}
                  disableLinks
                />
              </StyledMenuListItem>
            )
          })}
        </StyledMenuList>
      }
      isOpen
      placement={PLACEMENT.bottomRight}
      onClickOutside={onCloseMenu}
      onEsc={onCloseMenu}
      accessibilityType={ACCESSIBILITY_TYPE.menu}
      autoFocus={false}
      showArrow={false}
      popoverMargin={POPOVER_MARGIN}
      overrides={{
        Body: {
          props: {
            "data-testid": "stDataFrameButtonActionMenu",
          },
          style: {
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
            backgroundColor: "transparent",
            boxShadow: "none",
          },
        },
        Inner: {
          style: () => ({
            ...getPopoverContainerStyle(theme),
            backgroundColor: colors.bgColor,
            color: colors.bodyText,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.normal,
            overflow: "auto",
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
          }),
        },
      }}
    >
      {/* Invisible anchor element positioned at the click location */}
      <div
        data-testid="stDataFrameButtonActionMenuTarget"
        style={{
          // This is an invisible div that's used to position the menu.
          // The position is provided from outside via the `top` and `left` properties.
          // This a workaround for the fact that BaseWeb's Popover doesn't support
          // positioning to a virtual position and always requires a target
          // component for positioning.
          position: "fixed",
          top,
          left,
          visibility: "hidden",
          transform: "unset",
        }}
      />
    </Popover>
  )
}

export default memo(ButtonActionMenu)
