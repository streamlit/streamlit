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
  useRef,
  useState,
} from "react"

import { FloatingPortal } from "@floating-ui/react"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import { Quiver } from "~lib/dataframes/Quiver"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"

import FormattingMenu from "./FormattingMenu"
import StatisticsMenu from "./StatisticsMenu"
import { supportsStatistics } from "./statisticsUtils"
import {
  COLUMN_MENU_OFFSET,
  StyledColumnHeaderRow,
  StyledColumnMenuPanel,
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
  // Whether column statistics are enabled for this table. Defaults to true.
  canShowColumnStatistics?: boolean
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
  canShowColumnStatistics = true,
  onChangeFormat,
  onAutosize,
}: ColumnMenuProps): ReactElement {
  const [formatMenuOpen, setFormatMenuOpen] = useState(false)
  const [statsMenuOpen, setStatsMenuOpen] = useState(false)

  const handleFormatOpenChange = useCallback((open: boolean): void => {
    setFormatMenuOpen(open)
    if (open) setStatsMenuOpen(false)
  }, [])

  const handleStatsOpenChange = useCallback((open: boolean): void => {
    setStatsMenuOpen(open)
    if (open) setFormatMenuOpen(false)
  }, [])

  const { isCopied, copyToClipboard } = useCopyToClipboard()

  const { refs, floatingStyles } = useFloatingOverlay({
    open: true,
    placement: "bottom-end",
    offsetPx: COLUMN_MENU_OFFSET,
  })

  // Tracks whether a pointer button is currently pressed. Used by the onBlur
  // handlers to distinguish pointer-driven blur (click in sub-menu portal —
  // ignore, let document-level mouseover manage close) from keyboard-driven
  // blur (Tab away — close immediately).
  const pointerDownRef = useRef(false)
  useEffect(() => {
    const onDown = (): void => {
      pointerDownRef.current = true
    }
    const onUp = (): void => {
      pointerDownRef.current = false
    }
    document.addEventListener("pointerdown", onDown, true)
    document.addEventListener("pointerup", onUp, true)
    return () => {
      document.removeEventListener("pointerdown", onDown, true)
      document.removeEventListener("pointerup", onUp, true)
    }
  }, [])

  const { setFloatingRef } = useOverlayDismissal({
    isOpen: true,
    onClose: onCloseMenu,
    floatingSetFn: refs.setFloating,
    excludeSelectors: [
      '[data-testid="stDataFrameColumnFormattingMenu"]',
      '[data-testid="stDataFrameStatisticsMenu"]',
    ],
  })

  // Disable page scrolling while the menu is open to keep the menu and
  // column header aligned. The anchor coords are static at open time, so
  // autoUpdate cannot compensate for grid scroll — blocking is intentional.
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
    <>
      {/*
       * Invisible fixed-position div that serves as the floating-ui reference.
       * Its position (top/left from canvas coords) determines where the menu
       * appears. A real DOM ref lets autoUpdate work without VirtualElement.
       */}
      <div
        ref={refs.setReference}
        data-testid="stDataFrameColumnMenuTarget"
        style={{
          position: "fixed",
          top,
          left,
          width: 0,
          height: 0,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      />
      <FloatingPortal>
        <StyledColumnMenuPanel
          ref={setFloatingRef}
          data-testid="stDataFrameColumnMenu"
          style={floatingStyles}
          tabIndex={-1}
          autoFocus
        >
          <StyledMenuList role="menu" aria-label="Dataframe column menu">
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
                  <DynamicIcon
                    size="base"
                    iconValue=":material/arrow_upward:"
                  />
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
            {canShowColumnStatistics &&
              data &&
              supportsStatistics(column.kind) && (
                <StatisticsMenu
                  column={column}
                  data={data}
                  isOpen={statsMenuOpen}
                  onOpenChange={handleStatsOpenChange}
                >
                  <StyledMenuListItem
                    onFocus={() => handleStatsOpenChange(true)}
                    onBlur={e => {
                      if (pointerDownRef.current) return
                      const related = e.relatedTarget
                      if (
                        related?.closest(
                          '[data-testid="stDataFrameStatisticsMenu"]'
                        )
                      ) {
                        return
                      }
                      setStatsMenuOpen(false)
                    }}
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
                      <DynamicIcon
                        size="base"
                        iconValue=":material/bar_chart:"
                      />
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
                onOpenChange={handleFormatOpenChange}
                onChangeFormat={onChangeFormat}
                onCloseMenu={onCloseMenu}
              >
                <StyledMenuListItem
                  onFocus={() => handleFormatOpenChange(true)}
                  onBlur={e => {
                    if (pointerDownRef.current) return
                    const related = e.relatedTarget
                    if (
                      related?.closest(
                        '[data-testid="stDataFrameColumnFormattingMenu"]'
                      )
                    ) {
                      return
                    }
                    setFormatMenuOpen(false)
                  }}
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
                <DynamicIcon
                  size="base"
                  iconValue=":material/arrows_outward:"
                />
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
                <DynamicIcon
                  size="base"
                  iconValue=":material/visibility_off:"
                />
                Hide column
              </StyledMenuListItem>
            )}
          </StyledMenuList>
        </StyledColumnMenuPanel>
      </FloatingPortal>
    </>
  )
}

export default memo(ColumnMenu)
