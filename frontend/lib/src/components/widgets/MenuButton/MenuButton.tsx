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

import styled from "@emotion/styled"
import type { Key } from "@react-types/shared"
import type { CSSProperties, HTMLAttributes } from "react"
import {
  memo,
  ReactElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"

import { useResizeObserver } from "@react-aria/utils"
import { mergeProps, useButton, useMenuTrigger } from "react-aria"
import {
  Menu,
  MenuContext,
  MenuItem,
  OverlayTriggerStateContext,
  Popover,
  PopoverContext,
  Provider,
  RootMenuTriggerStateContext,
} from "react-aria-components"
import { useMenuTriggerState } from "react-stately"

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
  StyledMenuOptionIcon,
  StyledMenuOptionLabel,
} from "./styled-components"

const StreamlitMenuItem = styled(MenuItem)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginTop: theme.spacing.twoXS,
  marginBottom: theme.spacing.twoXS,
  padding: 0,
  background: "transparent",
  cursor: "pointer",
  listStyle: "none",
  minWidth: theme.sizes.minMenuWidth,
}))

const BUTTON_TYPE_TO_KIND: Record<string, BaseButtonKind> = {
  primary: BaseButtonKind.PRIMARY,
  secondary: BaseButtonKind.SECONDARY,
  tertiary: BaseButtonKind.TERTIARY,
}

interface MenuOptionContentProps {
  item: { label: string; value: string }
  isFocused?: boolean
}

/** Renders a single menu option (icon extraction + markdown label). */
const MenuOptionContent = memo(function MenuOptionContent({
  item,
  isFocused,
}: MenuOptionContentProps): ReactElement {
  const { icon, text } = extractLeadingMaterialIcon(item.label)
  return (
    <StyledHighlightWrapper $isHighlighted={isFocused}>
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

  const menuState = useMenuTriggerState({
    isOpen,
    onOpenChange: setIsOpen,
  })

  const buttonRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [buttonWidth, setButtonWidth] = useState<string | null>(null)

  useResizeObserver({
    ref: buttonRef,
    onResize: useCallback(() => {
      if (buttonRef.current) {
        setButtonWidth(`${buttonRef.current.offsetWidth}px`)
      }
    }, []),
  })

  const { menuTriggerProps, menuProps } = useMenuTrigger(
    { type: "menu" },
    menuState,
    buttonRef
  )

  const { buttonProps } = useButton(menuTriggerProps, buttonRef)

  const handleAction = useCallback(
    (key: Key): void => {
      const value = String(key)
      setIsOpen(false)
      if (buttonDisabled) {
        return
      }
      widgetMgr.setStringTriggerValue(
        element,
        value,
        { fromUi: true },
        fragmentId
      )
    },
    [buttonDisabled, element, widgetMgr, fragmentId]
  )

  return (
    <Box className="stMenuButton" data-testid="stMenuButton">
      <Provider
        values={[
          [OverlayTriggerStateContext, menuState],
          [RootMenuTriggerStateContext, menuState],
          [MenuContext, { ...menuProps, ref: scrollRef }],
          [
            PopoverContext,
            {
              trigger: "MenuTrigger",
              triggerRef: buttonRef,
              scrollRef,
              placement: "bottom start",
              offset: convertRemToPx(theme.spacing.twoXS),
              shouldFlip: true,
              containerPadding: isInSidebar ? 0 : 12,
              style: {
                ...getPopoverContainerStyle(theme),
                "--trigger-width": buttonWidth ?? undefined,
              } as CSSProperties,
              "aria-labelledby": menuProps["aria-labelledby"],
            },
          ],
        ]}
      >
        <div>
          <BaseButtonTooltip help={element.help} containerWidth={true}>
            <BaseButton
              {...mergeProps(buttonProps, {
                "data-testid": "stMenuButtonButton",
                kind,
                size: BaseButtonSize.SMALL,
                disabled: buttonDisabled,
                containerWidth: true,
                "aria-haspopup": "menu",
                "aria-expanded": menuState.isOpen,
              })}
              ref={buttonRef}
            >
              <StyledMenuButtonLabelContainer $hideChevron={hideChevron}>
                <DynamicButtonLabel icon={element.icon} label={element.label} />
                {!hideChevron && (
                  <StyledMenuButtonExpansionIcon aria-hidden="true">
                    <DynamicIcon
                      iconValue={
                        menuState.isOpen
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
        <Popover data-testid="stMenuButtonBody">
          <Menu
            selectionMode="none"
            onAction={handleAction}
            // react-aria-components Menu renders a div by default; e2e tests expect ul/li.
            {...({
              render: (props: HTMLAttributes<HTMLUListElement>) => (
                <ul {...props} />
              ),
            } as object)}
            style={{
              backgroundColor: theme.colors.bgColor,
              paddingTop: theme.spacing.threeXS,
              paddingBottom: theme.spacing.threeXS,
              paddingLeft: theme.spacing.xs,
              paddingRight: theme.spacing.xs,
              outline: "none",
              listStyle: "none",
              margin: theme.spacing.none,
            }}
          >
            {menuItems.map(item => {
              const { text } = extractLeadingMaterialIcon(item.label)
              return (
                <StreamlitMenuItem
                  key={item.value}
                  id={item.value}
                  textValue={text}
                  render={props => <li {...props} />}
                >
                  {({ isFocused }) => (
                    <MenuOptionContent item={item} isFocused={isFocused} />
                  )}
                </StreamlitMenuItem>
              )
            })}
          </Menu>
        </Popover>
      </Provider>
    </Box>
  )
}

export default memo(MenuButton)
