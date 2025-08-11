/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { memo, ReactElement, useCallback, useEffect, useState } from "react"

import { ACCESSIBILITY_TYPE, PLACEMENT, Popover } from "baseui/popover"

import { DynamicIcon } from "~lib/components/shared/Icon"
import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx, hasLightBackgroundColor } from "~lib/theme"

import FormattingMenu from "./FormattingMenu"
import {
  StyledColumnHeaderRow,
  StyledColumnNameText,
  StyledColumnNameWithIcon,
  StyledIconButton,
  StyledMenuDivider,
  StyledMenuList,
  StyledMenuListItem,
  StyledTypeIconContainer,
} from "./styled-components"

export interface ColumnMenuProps {
  // The top position of the menu
  top: number
  // The left position of the menu
  left: number
  // The selected column:
  column: BaseColumn
  // Callback used to instruct the parent to close the menu
  onCloseMenu: () => void
  // Callback to sort column
  // If undefined, the sort menu item will not be shown
  onSortColumn: ((direction: "asc" | "desc") => void) | undefined
  // Whether the column is pinned
  isColumnPinned: boolean
  // Callback to pin the column
  onPinColumn: () => void
  // Callback to unpin the column
  onUnpinColumn: () => void
  // Callback to hide the column
  onHideColumn?: () => void
  // Callback to change the column format
  onChangeFormat?: (format: string) => void
  // Callback to autosize the column
  onAutosize?: () => void
}

/**
 * A column context menu that provides interactive features for a grid column.
 */
function ColumnMenu({
  top,
  left,
  isColumnPinned,
  onPinColumn,
  onUnpinColumn,
  onCloseMenu,
  onSortColumn,
  onHideColumn,
  column,
  onChangeFormat,
  onAutosize,
}: ColumnMenuProps): ReactElement {
  const theme = useEmotionTheme()
  const [formatMenuOpen, setFormatMenuOpen] = useState(false)
  const { colors, fontSizes, radii, fontWeights } = theme

  const { isCopied, copyToClipboard } = useCopyToClipboard()

  // Disable page scrolling while the menu is open to keep the menu und
  // column header aligned.
  // This is done by preventing defaults on wheel and touch events:
  useEffect(() => {
    function preventScroll(e: WheelEvent | TouchEvent): void {
      e.preventDefault()
    }

    document.addEventListener("wheel", preventScroll, { passive: false })
    document.addEventListener("touchmove", preventScroll, { passive: false })

    return () => {
      document.removeEventListener("wheel", preventScroll)
      document.removeEventListener("touchmove", preventScroll)
    }
  }, [])

  const closeMenu = useCallback((): void => {
    onCloseMenu()
  }, [onCloseMenu])

  const handleCopyNameToClipboard = useCallback((): void => {
    copyToClipboard(column.title)
  }, [column.title, copyToClipboard])

  return (
    <Popover
      autoFocus
      aria-label="Dataframe column menu"
      content={
        <StyledMenuList>
          <StyledColumnHeaderRow>
            <StyledTypeIconContainer title={column.kind}>
              <DynamicIcon
                iconValue={column.typeIcon || ":material/notes:"}
                size="base"
                color="inherit"
              />
            </StyledTypeIconContainer>
            <StyledColumnNameWithIcon title={column.title}>
              <StyledColumnNameText>{column.title}</StyledColumnNameText>
              <StyledIconButton
                onClick={handleCopyNameToClipboard}
                title="Copy column name"
                aria-label="Copy column name"
              >
                <DynamicIcon
                  iconValue={
                    isCopied ? ":material/check:" : ":material/content_copy:"
                  }
                  size="sm"
                  margin="0"
                  color="inherit"
                />
              </StyledIconButton>
            </StyledColumnNameWithIcon>
          </StyledColumnHeaderRow>

          {onSortColumn && (
            <>
              <StyledMenuListItem
                onClick={() => {
                  onSortColumn("asc")
                  closeMenu()
                }}
                role="menuitem"
              >
                <DynamicIcon
                  size="base"
                  margin="0"
                  color="inherit"
                  iconValue=":material/arrow_upward:"
                />
                Sort ascending
              </StyledMenuListItem>
              <StyledMenuListItem
                onClick={() => {
                  onSortColumn("desc")
                  closeMenu()
                }}
                role="menuitem"
              >
                <DynamicIcon
                  size="base"
                  margin="0"
                  color="inherit"
                  iconValue=":material/arrow_downward:"
                />
                Sort descending
              </StyledMenuListItem>
              <StyledMenuDivider />
            </>
          )}
          {onChangeFormat && (
            <FormattingMenu
              columnKind={column.kind}
              isOpen={formatMenuOpen}
              onMouseEnter={() => setFormatMenuOpen(true)}
              onMouseLeave={() => setFormatMenuOpen(false)}
              onChangeFormat={onChangeFormat}
              onCloseMenu={closeMenu}
            >
              <StyledMenuListItem
                onMouseEnter={() => setFormatMenuOpen(true)}
                onMouseLeave={() => setFormatMenuOpen(false)}
                isActive={formatMenuOpen}
                hasSubmenu={true}
              >
                <div>
                  <DynamicIcon
                    size="base"
                    margin="0"
                    color="inherit"
                    iconValue=":material/format_list_numbered:"
                  />
                  Format
                </div>

                <DynamicIcon
                  size="base"
                  margin="0"
                  color="inherit"
                  iconValue=":material/chevron_right:"
                />
              </StyledMenuListItem>
            </FormattingMenu>
          )}
          {onAutosize && (
            <StyledMenuListItem
              onClick={() => {
                onAutosize()
                closeMenu()
              }}
            >
              <DynamicIcon
                size="base"
                margin="0"
                color="inherit"
                iconValue=":material/arrows_outward:"
              />
              Autosize
            </StyledMenuListItem>
          )}
          {isColumnPinned && (
            <StyledMenuListItem
              onClick={() => {
                onUnpinColumn()
                closeMenu()
              }}
            >
              <DynamicIcon
                size="base"
                margin="0"
                color="inherit"
                iconValue=":material/keep_off:"
              />
              Unpin column
            </StyledMenuListItem>
          )}
          {!isColumnPinned && (
            <StyledMenuListItem
              onClick={() => {
                onPinColumn()
                closeMenu()
              }}
            >
              <DynamicIcon
                size="base"
                margin="0"
                color="inherit"
                iconValue=":material/keep:"
              />
              Pin column
            </StyledMenuListItem>
          )}
          {onHideColumn && (
            <StyledMenuListItem
              onClick={() => {
                onHideColumn()
                closeMenu()
              }}
            >
              <DynamicIcon
                size="base"
                margin="0"
                color="inherit"
                iconValue=":material/visibility_off:"
              />
              Hide column
            </StyledMenuListItem>
          )}
        </StyledMenuList>
      }
      placement={PLACEMENT.bottomRight}
      accessibilityType={ACCESSIBILITY_TYPE.menu}
      showArrow={false}
      popoverMargin={convertRemToPx("0.375rem")}
      onClickOutside={!formatMenuOpen ? closeMenu : undefined}
      onEsc={closeMenu}
      overrides={{
        Body: {
          props: {
            "data-testid": "stDataFrameColumnMenu",
          },
          style: {
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",

            backgroundColor: "transparent",
          },
        },
        Inner: {
          style: {
            border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
            backgroundColor: hasLightBackgroundColor(theme)
              ? colors.bgColor
              : colors.secondaryBg,
            color: colors.bodyText,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.normal,
            // This is annoying, but a bunch of warnings get logged when the
            // shorthand version `borderRadius` is used here since the long
            // names are used by BaseWeb and mixing the two is apparently
            // bad :(
            borderTopLeftRadius: radii.default,
            borderTopRightRadius: radii.default,
            borderBottomLeftRadius: radii.default,
            borderBottomRightRadius: radii.default,
            // Prevent the menu hover background from overflowing the menu edges
            // This is only an issue if a high base radius is configured.
            overflow: "auto",
            // See the long comment about `borderRadius`. The same applies here
            // to `padding`.
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
          },
        },
      }}
      // We can always set the menu to open here since the dataframe
      // component controls if its open or not by adding it to the DOM or not.
      isOpen={true}
    >
      <div
        data-testid="stDataFrameColumnMenuTarget"
        style={{
          // This is an invisible div that's used to position the tooltip.
          // The position is provided from outside via the `top` and `left` properties.
          // This a workaround for the fact that BaseWeb's Popover  doesn't support
          // positioning to a virtual position and always requires a target
          // component for positioning.
          position: "fixed",
          top,
          left,
          visibility: "hidden",
          transform: "unset",
        }}
      ></div>
    </Popover>
  )
}

export default memo(ColumnMenu)
