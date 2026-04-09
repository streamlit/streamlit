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
  KeyboardEventHandler,
  memo,
  MouseEventHandler,
  ReactElement,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { StatefulMenu } from "baseui/menu"
import { PLACEMENT, TRIGGER_TYPE, Popover as UIPopover } from "baseui/popover"

import { MenuButton as MenuButtonProto } from "@streamlit/protobuf"

import IsSidebarContext from "~lib/components/core/IsSidebarContext"
import {
  Box,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
} from "~lib/components/shared/BaseButton/BaseButton"
import { BaseButtonTooltip } from "~lib/components/shared/BaseButton/BaseButtonTooltip"
import { DynamicButtonLabel } from "~lib/components/shared/BaseButton/DynamicButtonLabel"
import { StyledHighlightWrapper } from "~lib/components/shared/Highlight/styled-components"
import {
  DynamicIcon,
  extractLeadingMaterialIcon,
  isMenuStyleIconLabel,
} from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledMenuButtonExpansionIcon,
  StyledMenuButtonLabelContainer,
  StyledMenuItem,
  StyledMenuOptionIcon,
  StyledMenuOptionLabel,
} from "./styled-components"

const BUTTON_TYPE_TO_KIND: Record<string, BaseButtonKind> = {
  primary: BaseButtonKind.PRIMARY,
  secondary: BaseButtonKind.SECONDARY,
  tertiary: BaseButtonKind.TERTIARY,
}

interface MenuOptionProps {
  item: { label: string; value: string }
  $isHighlighted?: boolean
  onClick?: MouseEventHandler<HTMLLIElement>
  onMouseEnter?: MouseEventHandler<HTMLLIElement>
  onKeyDown?: KeyboardEventHandler<HTMLLIElement>
  /** BaseUI internal props that are destructured but not forwarded to DOM. */
  $disabled?: boolean
  $isFocused?: boolean
  $size?: string
  resetMenu?: () => void
  renderAll?: boolean
  [key: string]: unknown
}

/** Menu option component for BaseUI StatefulMenu override. */
const MenuOption = memo(function MenuOption({
  item,
  $isHighlighted,
  onClick,
  onMouseEnter,
  onKeyDown,
  // Filter out BaseUI internal props that shouldn't be passed to DOM
  $disabled: _$disabled,
  $isFocused: _$isFocused,
  $size: _$size,
  resetMenu: _resetMenu,
  renderAll: _renderAll,
  ...restProps
}: MenuOptionProps): ReactElement {
  const { icon, text } = extractLeadingMaterialIcon(item.label)
  return (
    <StyledMenuItem
      {...restProps}
      role="menuitem"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onKeyDown={onKeyDown}
    >
      <StyledHighlightWrapper $isHighlighted={$isHighlighted}>
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
            largerLabel={false}
            disableLinks
          />
        </StyledMenuOptionLabel>
      </StyledHighlightWrapper>
    </StyledMenuItem>
  )
})

export interface Props {
  disabled: boolean
  element: MenuButtonProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function MenuButton(props: Props): ReactElement {
  const { disabled, element, widgetMgr, fragmentId } = props
  const [isOpen, setIsOpen] = useState(false)
  const isInSidebar = useContext(IsSidebarContext)
  const theme = useEmotionTheme()

  const kind = BUTTON_TYPE_TO_KIND[element.type] ?? BaseButtonKind.SECONDARY

  const menuItems = useMemo(
    () => element.options.map(option => ({ label: option, value: option })),
    [element.options]
  )

  const buttonDisabled =
    disabled || element.disabled || element.options.length === 0

  // Hide the chevron if the label is a menu-style icon (e.g., :material/menu:)
  const hideChevron = isMenuStyleIconLabel(element.icon, element.label)

  const handleItemSelect = useCallback(
    (params: { item: { value: string } }) => {
      setIsOpen(false)
      if (buttonDisabled) {
        return
      }
      widgetMgr.setStringTriggerValue(
        element,
        params.item.value,
        { fromUi: true },
        fragmentId
      )
    },
    [buttonDisabled, element, widgetMgr, fragmentId]
  )

  return (
    <Box className="stMenuButton" data-testid="stMenuButton">
      <UIPopover
        triggerType={TRIGGER_TYPE.click}
        placement={PLACEMENT.bottomLeft}
        isOpen={isOpen}
        onClickOutside={() => setIsOpen(false)}
        onEsc={() => setIsOpen(false)}
        ignoreBoundary={isInSidebar}
        popoverMargin={convertRemToPx(theme.spacing.twoXS)}
        renderAll={true}
        content={() => (
          <StatefulMenu
            items={menuItems}
            onItemSelect={handleItemSelect}
            overrides={{
              List: {
                props: {
                  role: "menu",
                },
                style: {
                  backgroundColor: theme.colors.bgColor,
                  paddingTop: theme.spacing.threeXS,
                  paddingBottom: theme.spacing.threeXS,
                  paddingLeft: theme.spacing.xs,
                  paddingRight: theme.spacing.xs,
                  boxShadow: "none",
                  outline: "none",
                },
              },
              Option: {
                component: MenuOption,
              },
            }}
          />
        )}
        overrides={{
          Body: {
            props: {
              "data-testid": "stMenuButtonBody",
            },
            style: () => ({
              ...getPopoverContainerStyle(theme),

              // Use xl border radius instead of the default
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              borderBottomRightRadius: theme.radii.xl,
              borderBottomLeftRadius: theme.radii.xl,

              marginRight: theme.spacing.lg,
              marginBottom: theme.spacing.lg,
              maxHeight: "70vh",
              overflow: "auto",
            }),
          },
        }}
      >
        {/* Wrapped in div for BaseUI Popover anchor positioning */}
        <div>
          <BaseButtonTooltip help={element.help} containerWidth={true}>
            <BaseButton
              data-testid="stMenuButtonButton"
              kind={kind}
              size={BaseButtonSize.SMALL}
              disabled={buttonDisabled}
              containerWidth={true}
              onClick={() => setIsOpen(!isOpen)}
              aria-haspopup="menu"
              aria-expanded={isOpen}
            >
              <StyledMenuButtonLabelContainer $hideChevron={hideChevron}>
                <DynamicButtonLabel
                  icon={element.icon}
                  label={element.label}
                />
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
        </div>
      </UIPopover>
    </Box>
  )
}

export default memo(MenuButton)
