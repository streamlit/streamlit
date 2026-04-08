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

import { Menu } from "@base-ui-components/react/menu"
import styled from "@emotion/styled"
import {
  memo,
  ReactElement,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

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

const StyledMenuPopup = styled(Menu.Popup)(({ theme }) => ({
  ...getPopoverContainerStyle(theme),

  borderTopLeftRadius: theme.radii.xl,
  borderTopRightRadius: theme.radii.xl,
  borderBottomRightRadius: theme.radii.xl,
  borderBottomLeftRadius: theme.radii.xl,

  marginRight: theme.spacing.lg,
  marginBottom: theme.spacing.lg,
  maxHeight: "70vh",
  overflow: "auto",
}))

const BUTTON_TYPE_TO_KIND: Record<string, BaseButtonKind> = {
  primary: BaseButtonKind.PRIMARY,
  secondary: BaseButtonKind.SECONDARY,
  tertiary: BaseButtonKind.TERTIARY,
}

interface MenuOptionRowProps {
  item: { label: string; value: string }
  onSelect: (value: string) => void
}

const MenuOptionRow = memo(function MenuOptionRow({
  item,
  onSelect,
}: MenuOptionRowProps): ReactElement {
  const { icon, text } = extractLeadingMaterialIcon(item.label)
  return (
    <Menu.Item
      closeOnClick
      label={text}
      onClick={() => onSelect(item.value)}
      render={(props, state) => (
        <StyledMenuItem {...props} as="div">
          <StyledHighlightWrapper $isHighlighted={state.highlighted}>
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
      )}
    />
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
    (value: string): void => {
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

  const collisionBoundary: "clipping-ancestors" | Element =
    isInSidebar && typeof document !== "undefined"
      ? document.documentElement
      : "clipping-ancestors"

  return (
    <Box className="stMenuButton" data-testid="stMenuButton">
      <Menu.Root open={isOpen} onOpenChange={setIsOpen} modal={false}>
        {/* Wrapped in div for anchor positioning (matches prior BaseWeb layout). */}
        <div>
          <BaseButtonTooltip help={element.help} containerWidth={true}>
            <Menu.Trigger
              disabled={buttonDisabled}
              render={
                <BaseButton
                  data-testid="stMenuButtonButton"
                  kind={kind}
                  size={BaseButtonSize.SMALL}
                  disabled={buttonDisabled}
                  containerWidth={true}
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
              }
            />
          </BaseButtonTooltip>
        </div>

        <Menu.Portal>
          <Menu.Positioner
            side="bottom"
            align="start"
            sideOffset={convertRemToPx(theme.spacing.twoXS)}
            collisionBoundary={collisionBoundary}
          >
            <StyledMenuPopup
              data-testid="stMenuButtonBody"
              style={{
                backgroundColor: theme.colors.bgColor,
                paddingTop: theme.spacing.threeXS,
                paddingBottom: theme.spacing.threeXS,
                paddingLeft: theme.spacing.xs,
                paddingRight: theme.spacing.xs,
                boxShadow: "none",
                outline: "none",
              }}
            >
              {menuItems.map(item => (
                <MenuOptionRow
                  key={item.value}
                  item={item}
                  onSelect={handleItemSelect}
                />
              ))}
            </StyledMenuPopup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Box>
  )
}

export default memo(MenuButton)
