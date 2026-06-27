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
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { FloatingPortal } from "@floating-ui/react"
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
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"
import { convertRemToPx } from "~lib/theme/utils"
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

export interface Props {
  disabled: boolean
  element: MenuButtonProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function MenuButton(props: Props): ReactElement {
  const { disabled, element, widgetMgr, fragmentId } = props

  const theme = useEmotionTheme()
  const [isOpen, setIsOpen] = useState(false)
  const instanceId = useId()
  // Anchor ref on the outer container — mirrors the original anchorRef pattern,
  // avoiding the ref duplication issue that occurs when BaseButtonTooltip
  // renders its children twice (desktop tooltip + mobile variant). Used by
  // restoreFocusFn to find and focus the trigger button after Escape.
  const containerRef = useRef<HTMLDivElement>(null)

  // Floating UI provides scroll-tracking via autoUpdate. RAC's Popover is
  // fully replaced with FloatingPortal here because Menu is a self-contained
  // collection root — it doesn't need to be a child of any other RAC component.
  const { refs, floatingStyles } = useFloatingOverlay({
    open: isOpen,
    placement: "bottom-start",
    offsetPx: convertRemToPx(theme.spacing.twoXS),
  })

  // Custom dismissal via capture-phase DOM listeners.
  // restoreFocusFn uses querySelector on containerRef rather than a direct button
  // ref to avoid the BaseButtonTooltip double-render issue.
  const { setFloatingRef, setReferenceRef } = useOverlayDismissal({
    isOpen,
    onClose: () => setIsOpen(false),
    floatingSetFn: refs.setFloating,
    referenceSetFn: refs.setReference,
    restoreFocusFn: () =>
      containerRef.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus(),
    closeOnTab: true,
  })

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
      ref={setReferenceRef}
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
      {isOpen && (
        <FloatingPortal>
          <StyledMenuPopover
            ref={setFloatingRef}
            data-testid="stMenuButtonBody"
            style={floatingStyles}
          >
            <StyledMenuList
              onAction={handleItemSelect}
              aria-label={
                extractLeadingMaterialIcon(element.label).text || "Menu"
              }
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
        </FloatingPortal>
      )}
    </Box>
  )
}

export default memo(MenuButton)
