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

import { memo, ReactElement, useCallback, useEffect, useState } from "react"

import { ACCESSIBILITY_TYPE, PLACEMENT, Popover } from "baseui/popover"

import { getPopoverContainerStyle } from "~lib/components/shared/Base/styled-components"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import { Quiver } from "~lib/dataframes/Quiver"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme/utils"

import FormattingMenu from "./FormattingMenu"
import StatisticsMenu from "./StatisticsMenu"
import { supportsStatistics } from "./statisticsUtils"
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
  // The Arrow data for statistics computation.
  // Optional because DataFrame always provides it, but data-editor scenarios
  // may not have Quiver data bound initially. Statistics menu is only shown
  // when data is available.
  data?: Quiver
  // Whether the table is in an editable mode (st.data_editor).
  // Statistics menu is hidden for editable tables since the displayed stats
  // would reflect the original data, not the user's edits.
  isEditable?: boolean
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
  data,
  isEditable,
  onChangeFormat,
  onAutosize,
}: ColumnMenuProps): ReactElement {
  const theme = useEmotionTheme()
  const [formatMenuOpen, setFormatMenuOpen] = useState(false)
  const [statsMenuOpen, setStatsMenuOpen] = useState(false)
  const { colors, fontSizes, fontWeights } = theme

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
                size="base"
                iconValue={column.typeIcon || ":material/notes:"}
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
                  size="sm"
                  iconValue={
                    isCopied ? ":material/check:" : ":material/content_copy:"
                  }
                />
              </StyledIconButton>
            </StyledColumnNameWithIcon>
          </StyledColumnHeaderRow>

          {onSortColumn && (
            <>
              <StyledMenuListItem
                onClick={() => {
                  onSortColumn("asc")
                  onCloseMenu()
                }}
                role="menuitem"
              >
                <DynamicIcon size="base" iconValue=":material/arrow_upward:" />
                Sort ascending
              </StyledMenuListItem>
              <StyledMenuListItem
                onClick={() => {
                  onSortColumn("desc")
                  onCloseMenu()
                }}
                role="menuitem"
              >
                <DynamicIcon
                  size="base"
                  iconValue=":material/arrow_downward:"
                />
                Sort descending
              </StyledMenuListItem>
              <StyledMenuDivider />
            </>
          )}
          {data && !isEditable && supportsStatistics(column.kind) && (
            <StatisticsMenu
              column={column}
              data={data}
              isOpen={statsMenuOpen}
              onMouseEnter={() => setStatsMenuOpen(true)}
              onMouseLeave={() => setStatsMenuOpen(false)}
            >
              <StyledMenuListItem
                onMouseEnter={() => setStatsMenuOpen(true)}
                onMouseLeave={() => setStatsMenuOpen(false)}
                onFocus={() => setStatsMenuOpen(true)}
                onBlur={() => setStatsMenuOpen(false)}
                isActive={statsMenuOpen}
                hasSubmenu={true}
                role="menuitem"
                // The statistics popover is a read-only informational panel
                // (no focus management/focus lock), so "true" is more accurate
                // than "dialog", which implies a focusable dialog widget.
                aria-haspopup="true"
                aria-expanded={statsMenuOpen}
                tabIndex={0}
              >
                <div>
                  <DynamicIcon size="base" iconValue=":material/bar_chart:" />
                  Statistics
                </div>
                <DynamicIcon
                  size="base"
                  iconValue=":material/chevron_right:"
                />
              </StyledMenuListItem>
            </StatisticsMenu>
          )}
          {onChangeFormat && (
            <FormattingMenu
              columnKind={column.kind}
              isOpen={formatMenuOpen}
              onMouseEnter={() => setFormatMenuOpen(true)}
              onMouseLeave={() => setFormatMenuOpen(false)}
              onChangeFormat={onChangeFormat}
              onCloseMenu={onCloseMenu}
            >
              <StyledMenuListItem
                onMouseEnter={() => setFormatMenuOpen(true)}
                onMouseLeave={() => setFormatMenuOpen(false)}
                onFocus={() => setFormatMenuOpen(true)}
                onBlur={() => setFormatMenuOpen(false)}
                isActive={formatMenuOpen}
                hasSubmenu={true}
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={formatMenuOpen}
                tabIndex={0}
              >
                <div>
                  <DynamicIcon
                    size="base"
                    iconValue=":material/format_list_numbered:"
                  />
                  Format
                </div>

                <DynamicIcon
                  size="base"
                  iconValue=":material/chevron_right:"
                />
              </StyledMenuListItem>
            </FormattingMenu>
          )}
          {onAutosize && (
            <StyledMenuListItem
              onClick={() => {
                onAutosize()
                onCloseMenu()
              }}
              role="menuitem"
            >
              <DynamicIcon size="base" iconValue=":material/arrows_outward:" />
              Autosize
            </StyledMenuListItem>
          )}
          {isColumnPinned && (
            <StyledMenuListItem
              onClick={() => {
                onUnpinColumn()
                onCloseMenu()
              }}
              role="menuitem"
            >
              <DynamicIcon size="base" iconValue=":material/keep_off:" />
              Unpin column
            </StyledMenuListItem>
          )}
          {!isColumnPinned && (
            <StyledMenuListItem
              onClick={() => {
                onPinColumn()
                onCloseMenu()
              }}
              role="menuitem"
            >
              <DynamicIcon size="base" iconValue=":material/keep:" />
              Pin column
            </StyledMenuListItem>
          )}
          {onHideColumn && (
            <StyledMenuListItem
              onClick={() => {
                onHideColumn()
                onCloseMenu()
              }}
              role="menuitem"
            >
              <DynamicIcon size="base" iconValue=":material/visibility_off:" />
              Hide column
            </StyledMenuListItem>
          )}
        </StyledMenuList>
      }
      placement={PLACEMENT.bottomRight}
      accessibilityType={ACCESSIBILITY_TYPE.menu}
      showArrow={false}
      popoverMargin={convertRemToPx("0.375rem")}
      onClickOutside={
        !formatMenuOpen && !statsMenuOpen ? onCloseMenu : undefined
      }
      onEsc={onCloseMenu}
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
            // Remove baseui's default shadow; shadow is on Inner
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
            // Prevent the menu hover background from overflowing the menu edges
            // This is only an issue if a high base radius is configured.
            overflow: "auto",
            // See the long comment about `borderRadius`. The same applies here
            // to `padding`.
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
          }),
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
