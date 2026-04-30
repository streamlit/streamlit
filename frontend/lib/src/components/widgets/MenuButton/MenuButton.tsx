/** @jsxImportSource @emotion/react */
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
  MouseEventHandler,
  ReactElement,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { css } from "@emotion/react"
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react"

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
import useTimeout from "~lib/hooks/useTimeout"
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
}

/** Menu option row with optional leading material icon extracted from the label. */
const MenuOption = memo(function MenuOption({
  item,
  $isHighlighted,
  onClick,
  onMouseEnter,
}: MenuOptionProps): ReactElement {
  const { icon, text } = extractLeadingMaterialIcon(item.label)
  return (
    <StyledMenuItem
      role="menuitem"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
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

const TYPEAHEAD_CLEAR_MS = 500

function MenuButton(props: Props): ReactElement {
  const { disabled, element, widgetMgr, fragmentId } = props
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const isInSidebar = useContext(IsSidebarContext)
  const theme = useEmotionTheme()
  const menuListRef = useRef<HTMLUListElement>(null)
  const typeaheadBufferRef = useRef("")

  const { clear: clearTypeaheadTimer, restart: restartTypeaheadClear } =
    useTimeout(
      () => {
        typeaheadBufferRef.current = ""
      },
      null,
      { autoStart: false }
    )

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

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen && !buttonDisabled,
    onOpenChange: next => {
      if (!next) {
        setIsOpen(false)
      }
    },
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(convertRemToPx(theme.spacing.twoXS)),
      flip({
        boundary: isInSidebar ? document.documentElement : undefined,
      }),
      shift({ padding: convertRemToPx(theme.spacing.sm) }),
    ],
  })

  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  })

  const role = useRole(context, { role: "menu" })

  const { getFloatingProps } = useInteractions([dismiss, role])

  useEffect(() => {
    if (isOpen && menuItems.length > 0) {
      setHighlightedIndex(0)
      typeaheadBufferRef.current = ""
      requestAnimationFrame(() => {
        menuListRef.current?.focus()
      })
    }
  }, [isOpen, menuItems.length])

  const applyTypeahead = useCallback(
    (char: string) => {
      clearTypeaheadTimer()
      typeaheadBufferRef.current += char
      restartTypeaheadClear(TYPEAHEAD_CLEAR_MS)

      const buffer = typeaheadBufferRef.current.toLowerCase()
      const matchIdx = menuItems.findIndex(it => {
        const { text } = extractLeadingMaterialIcon(it.label)
        const visible = text.toLowerCase()
        const full = it.label.toLowerCase()
        const value = it.value.toLowerCase()
        return (
          visible.startsWith(buffer) ||
          full.startsWith(buffer) ||
          value.startsWith(buffer)
        )
      })
      if (matchIdx >= 0) {
        setHighlightedIndex(matchIdx)
      }
    },
    [clearTypeaheadTimer, menuItems, restartTypeaheadClear]
  )

  const onMenuKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLUListElement>) => {
      if (menuItems.length === 0) {
        return
      }

      const maxIdx = menuItems.length - 1

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault()
          setHighlightedIndex(i => Math.min(i + 1, maxIdx))
          return
        }
        case "ArrowUp": {
          e.preventDefault()
          setHighlightedIndex(i => Math.max(i - 1, 0))
          return
        }
        case "Home": {
          e.preventDefault()
          setHighlightedIndex(0)
          return
        }
        case "End": {
          e.preventDefault()
          setHighlightedIndex(maxIdx)
          return
        }
        case "Enter": {
          e.preventDefault()
          const item = menuItems[highlightedIndex]
          if (item) {
            handleItemSelect({ item })
          }
          return
        }
        default: {
          if (
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault()
            applyTypeahead(e.key)
          }
        }
      }
    },
    [applyTypeahead, handleItemSelect, highlightedIndex, menuItems]
  )

  const menuBodyCss = useMemo(
    () =>
      css({
        zIndex: theme.zIndices.popup,
        boxSizing: "border-box",
        ...getPopoverContainerStyle(theme),

        borderTopLeftRadius: theme.radii.xl,
        borderTopRightRadius: theme.radii.xl,
        borderBottomRightRadius: theme.radii.xl,
        borderBottomLeftRadius: theme.radii.xl,

        marginRight: theme.spacing.lg,
        marginBottom: theme.spacing.lg,
        maxHeight: "70vh",
        overflow: "auto",
      }),
    [theme]
  )

  const menuListStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.bgColor,
      paddingTop: theme.spacing.threeXS,
      paddingBottom: theme.spacing.threeXS,
      paddingLeft: theme.spacing.xs,
      paddingRight: theme.spacing.xs,
      boxShadow: "none",
      outline: "none",
      margin: 0,
      listStyle: "none",
    }),
    [theme]
  )

  return (
    <Box className="stMenuButton" data-testid="stMenuButton">
      <div ref={refs.setReference}>
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
      </div>
      {isOpen && !buttonDisabled && (
        <FloatingPortal>
          <FloatingFocusManager
            context={context}
            modal={false}
            initialFocus={-1}
            returnFocus
            guards={false}
          >
            <div
              // eslint-disable-next-line react-hooks/refs -- @floating-ui floating ref setter
              ref={refs.setFloating}
              data-testid="stMenuButtonBody"
              css={menuBodyCss}
              style={floatingStyles}
              {...getFloatingProps()}
            >
              <ul
                ref={menuListRef}
                role="menu"
                tabIndex={-1}
                onKeyDown={onMenuKeyDown}
                style={menuListStyle}
              >
                {menuItems.map((item, idx) => (
                  <MenuOption
                    key={item.value}
                    item={item}
                    $isHighlighted={idx === highlightedIndex}
                    onClick={() => handleItemSelect({ item })}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  />
                ))}
              </ul>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </Box>
  )
}

export default memo(MenuButton)
