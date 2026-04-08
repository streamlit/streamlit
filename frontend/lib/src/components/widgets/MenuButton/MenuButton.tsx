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
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
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
  StyledMenuOptionIcon,
  StyledMenuOptionLabel,
} from "./styled-components"

const BUTTON_TYPE_TO_KIND: Record<string, BaseButtonKind> = {
  primary: BaseButtonKind.PRIMARY,
  secondary: BaseButtonKind.SECONDARY,
  tertiary: BaseButtonKind.TERTIARY,
}

/** Highlight row when Radix marks the parent item as `[data-highlighted]`. */
const MenuOptionHighlight = styled(StyledHighlightWrapper)(({ theme }) => ({
  "[data-highlighted] > &": {
    background: theme.colors.darkenedBgMix15,
  },
}))

const StyledDropdownMenuContent = styled(DropdownMenuPrimitive.Content)(
  ({ theme }) => ({
    ...getPopoverContainerStyle(theme),

    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    borderBottomRightRadius: theme.radii.xl,
    borderBottomLeftRadius: theme.radii.xl,

    marginRight: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    maxHeight: "70vh",
    overflow: "auto",

    backgroundColor: theme.colors.bgColor,
    paddingTop: theme.spacing.threeXS,
    paddingBottom: theme.spacing.threeXS,
    paddingLeft: theme.spacing.xs,
    paddingRight: theme.spacing.xs,
    boxShadow: "none",
    outline: "none",
  })
)

const StyledDropdownMenuItem = styled(DropdownMenuPrimitive.Item)(
  ({ theme }) => ({
    display: "flex",
    alignItems: "center",
    marginTop: theme.spacing.twoXS,
    marginBottom: theme.spacing.twoXS,
    padding: 0,
    background: "transparent",
    cursor: "pointer",
    listStyle: "none",
    minWidth: theme.sizes.minMenuWidth,
    outline: "none",
  })
)

interface MenuOptionContentProps {
  item: { label: string; value: string }
}

/** Renders a menu row with optional leading material icon and markdown label. */
const MenuOptionContent = memo(function MenuOptionContent({
  item,
}: MenuOptionContentProps): ReactElement {
  const { icon, text } = extractLeadingMaterialIcon(item.label)
  return (
    <MenuOptionHighlight>
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
    </MenuOptionHighlight>
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

  const sideOffset = convertRemToPx(theme.spacing.twoXS)

  return (
    <Box className="stMenuButton" data-testid="stMenuButton">
      <DropdownMenuPrimitive.Root
        modal={false}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <DropdownMenuPrimitive.Trigger asChild>
          <div style={{ width: "100%" }}>
            <BaseButtonTooltip help={element.help} containerWidth={true}>
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
            </BaseButtonTooltip>
          </div>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <StyledDropdownMenuContent
            data-testid="stMenuButtonBody"
            side="bottom"
            align="start"
            sideOffset={sideOffset}
            avoidCollisions={!isInSidebar}
            collisionPadding={sideOffset}
            collisionBoundary={
              typeof document !== "undefined"
                ? document.documentElement
                : undefined
            }
          >
            {menuItems.map(item => (
              <StyledDropdownMenuItem
                key={item.value}
                onSelect={() => handleItemSelect(item.value)}
              >
                <MenuOptionContent item={item} />
              </StyledDropdownMenuItem>
            ))}
          </StyledDropdownMenuContent>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </Box>
  )
}

export default memo(MenuButton)
