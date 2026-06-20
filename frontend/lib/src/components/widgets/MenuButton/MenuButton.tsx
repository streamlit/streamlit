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
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { type Key } from "react-aria-components"

import { MenuButton as MenuButtonProto } from "@streamlit/protobuf"

import { Box } from "~lib/components/shared/Base/styled-components"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "~lib/components/shared/BaseButton/BaseButton"
import { BaseButtonTooltip } from "~lib/components/shared/BaseButton/BaseButtonTooltip"
import { DynamicButtonLabel } from "~lib/components/shared/BaseButton/DynamicButtonLabel"
import {
  DynamicIcon,
  extractLeadingMaterialIcon,
  isMenuStyleIconLabel,
} from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledMenuButtonExpansionIcon,
  StyledMenuButtonLabelContainer,
  StyledMenuList,
  StyledMenuListItem,
  StyledMenuOptionIcon,
  StyledMenuOptionLabel,
  StyledMenuPopover,
} from "./styled-components"

const BUTTON_TYPE_TO_KIND: Record<string, BaseButtonKind> = {
  primary: BaseButtonKind.PRIMARY,
  secondary: BaseButtonKind.SECONDARY,
  tertiary: BaseButtonKind.TERTIARY,
}

// Passed to RAC Popover to disable its internal close-on-blur/interact-outside
// paths. All dismissal is handled by our own capture-phase useEffect instead.
const NEVER_CLOSE = (): boolean => false

export interface Props {
  disabled: boolean
  element: MenuButtonProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function MenuButton(props: Props): ReactElement {
  const { disabled, element, widgetMgr, fragmentId } = props

  const [isOpen, setIsOpen] = useState(false)
  const instanceId = useId()
  // Anchor ref on the outer container — mirrors the original anchorRef pattern,
  // avoiding the ref duplication issue that occurs when BaseButtonTooltip
  // renders its children twice (desktop tooltip + mobile variant).
  const containerRef = useRef<HTMLDivElement>(null)
  // Ref to the popover DOM element — needed by the outside-click handler below
  // to distinguish clicks on portal-rendered menu items from true outside clicks.
  const popoverRef = useRef<HTMLElement>(null)

  // Custom dismissal via capture-phase DOM listeners.
  //
  // Why not use RAC's built-in close paths? The popover requires `isNonModal`
  // to prevent ariaHideOutside from marking the page `inert` (which would block
  // outside clicks). But `isNonModal` enables useCloseOnScroll inside RAC's
  // useOverlayPosition — closing the menu whenever a parent container scrolls
  // (e.g. Playwright auto-scrolling to a button below the fold). It also leaves
  // shouldCloseOnBlur active, which fires spuriously in Chromium after
  // autoFocus="first". Rather than fight each path individually, we disable all
  // RAC close channels (no onOpenChange, shouldCloseOnInteractOutside=false) and
  // implement the two behaviors we actually need: outside-click and Escape/Tab.
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: PointerEvent): void => {
      const target = e.target as Node
      // Close only when the pointer lands outside BOTH the trigger container
      // and the portal-rendered popover. Clicks inside either are handled by
      // their own React handlers (trigger onClick toggle / MenuItem onAction).
      if (
        !containerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape" || e.key === "Tab") {
        setIsOpen(false)
        if (e.key === "Escape") {
          // Stop propagation so parent overlays (e.g. st.dialog) don't also
          // dismiss — only the innermost overlay should close per ARIA pattern.
          e.stopPropagation()
          e.preventDefault()
          containerRef.current
            ?.querySelector<HTMLButtonElement>("button")
            ?.focus()
        }
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [isOpen])

  const kind = BUTTON_TYPE_TO_KIND[element.type] ?? BaseButtonKind.SECONDARY

  const menuItems = useMemo(
    () => element.options.map(option => ({ label: option, value: option })),
    [element.options]
  )

  const buttonDisabled =
    disabled || element.disabled || element.options.length === 0

  const hideChevron = isMenuStyleIconLabel(element.icon, element.label)

  const handleItemSelect = useCallback(
    (key: Key) => {
      if (buttonDisabled) {
        return
      }
      // Strip the instance prefix added for DOM id uniqueness
      const value = String(key).slice(instanceId.length)
      widgetMgr.setStringTriggerValue(
        element,
        value,
        { fromUi: true },
        fragmentId
      )
      setIsOpen(false)
    },
    [buttonDisabled, element, widgetMgr, fragmentId, instanceId]
  )

  return (
    <Box
      ref={containerRef}
      className="stMenuButton"
      data-testid="stMenuButton"
    >
      <BaseButtonTooltip help={element.help} containerWidth={true}>
        <BaseButton
          data-testid="stMenuButtonButton"
          kind={kind}
          size={BaseButtonSize.SMALL}
          disabled={buttonDisabled}
          containerWidth={true}
          onClick={() => setIsOpen(o => !o)}
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <StyledMenuButtonLabelContainer $hideChevron={hideChevron}>
            <DynamicButtonLabel icon={element.icon} label={element.label} />
            {!hideChevron && (
              <StyledMenuButtonExpansionIcon aria-hidden="true">
                <DynamicIcon
                  iconValue={
                    isOpen
                      ? ":material/expand_less:"
                      : ":material/expand_more:"
                  }
                  size="lg"
                />
              </StyledMenuButtonExpansionIcon>
            )}
          </StyledMenuButtonLabelContainer>
        </BaseButton>
      </BaseButtonTooltip>
      <StyledMenuPopover
        ref={popoverRef}
        triggerRef={containerRef}
        data-testid="stMenuButtonBody"
        isOpen={isOpen}
        // isNonModal prevents ariaHideOutside from adding `inert` to the rest of
        // the page. Without it, clicking outside the popover would fail in E2E
        // tests because the target element is marked inert by the overlay.
        // Outside-click and Escape dismissal are handled by the useEffect above.
        isNonModal
        shouldCloseOnInteractOutside={NEVER_CLOSE}
        offset={4}
        placement="bottom start"
      >
        <StyledMenuList
          onAction={handleItemSelect}
          aria-label={extractLeadingMaterialIcon(element.label).text || "Menu"}
          autoFocus="first"
        >
          {menuItems.map(item => {
            const { icon, text } = extractLeadingMaterialIcon(item.label)
            return (
              <StyledMenuListItem
                key={item.value}
                id={`${instanceId}${item.value}`}
                textValue={text}
              >
                <StyledMenuOptionLabel>
                  {icon && (
                    <StyledMenuOptionIcon aria-hidden="true">
                      <DynamicIcon iconValue={icon} size="md" />
                    </StyledMenuOptionIcon>
                  )}
                  <StreamlitMarkdown
                    source={text}
                    allowHTML={false}
                    isLabel
                    disableLinks
                  />
                </StyledMenuOptionLabel>
              </StyledMenuListItem>
            )
          })}
        </StyledMenuList>
      </StyledMenuPopover>
    </Box>
  )
}

export default memo(MenuButton)
