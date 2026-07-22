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

import { memo, ReactElement, useEffect, useRef } from "react"

import { FloatingFocusManager } from "@floating-ui/react"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import { DataFrameOverlayPortal } from "~lib/components/widgets/DataFrame/DataFrameOverlayPortal"
import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"
import { useScrollbarGutterSize } from "~lib/hooks/useScrollbarGutterSize"

import {
  COLUMN_MENU_OFFSET,
  StyledCheckboxInput,
  StyledCheckboxLabel,
  StyledCheckboxMark,
  StyledCheckboxRoot,
  StyledColumnVisibilityMenuContent,
  StyledColumnVisibilityMenuPanel,
  StyledMenuDivider,
} from "./styled-components"

const NAMELESS_INDEX_NAME = "(index)"

/**
 * Determines if a non-index column is effectively hidden by the configured column order.
 * The column order may contain either ids or names.
 *
 * @param column - The column to check.
 * @param columnOrder - The column order to check.
 * @returns True if the column is effectively hidden, false otherwise.
 */
function isHiddenViaColumnOrder(
  column: BaseColumn,
  columnOrder: string[]
): boolean {
  if (!columnOrder.length || column.isIndex) return false
  return !columnOrder.includes(column.id) && !columnOrder.includes(column.name)
}

interface CheckboxItemProps {
  /** The label to display for the checkbox. */
  label: string
  /** The initial value of the checkbox. */
  initialValue: boolean
  /** The state of the checkbox. */
  isIndeterminate?: boolean
  /** The callback that is called when the checkbox is checked/unchecked. */
  onChange: (checked: boolean) => void
}

const CheckboxItem: React.FC<CheckboxItemProps> = ({
  label,
  initialValue,
  isIndeterminate,
  onChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)

  // Set the indeterminate property imperatively — it cannot be set via HTML attributes.
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = isIndeterminate ?? false
    }
  }, [isIndeterminate])

  return (
    <StyledCheckboxRoot>
      <StyledCheckboxInput
        ref={inputRef}
        type="checkbox"
        checked={initialValue}
        aria-label={label}
        aria-checked={isIndeterminate ? "mixed" : undefined}
        onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
          onChange(e.target.checked)
        }}
      />
      <StyledCheckboxMark
        aria-hidden="true"
        data-checked={initialValue ? "true" : undefined}
        data-indeterminate={isIndeterminate ? "true" : undefined}
      >
        {isIndeterminate ? (
          <svg viewBox="0 0 10 2" aria-hidden="true">
            <line x1="1" y1="1" x2="9" y2="1" />
          </svg>
        ) : initialValue ? (
          <svg viewBox="0 0 10 8" aria-hidden="true">
            <polyline points="1 4 4 7 9 1" />
          </svg>
        ) : null}
      </StyledCheckboxMark>
      <StyledCheckboxLabel>{label}</StyledCheckboxLabel>
    </StyledCheckboxRoot>
  )
}

export interface ColumnVisibilityMenuProps {
  /** The columns to display in the menu. */
  columns: BaseColumn[]
  /** The order of the columns. */
  columnOrder: string[]
  /** The callback to set the order of the columns. */
  setColumnOrder: React.Dispatch<React.SetStateAction<string[]>>
  /** The callback to hide a column. */
  hideColumn: (columnId: string) => void
  /** The callback to show a column. */
  showColumn: (columnId: string) => void
  /** The toolbar action that opens the menu. */
  children: React.ReactNode
  /** Whether the menu is open. */
  isOpen: boolean
  /** A callback called when the menu is closed. */
  onClose: () => void
}

/**
 * A menu that allows the user to hide and show columns in the data grid.
 */
const ColumnVisibilityMenu: React.FC<ColumnVisibilityMenuProps> = ({
  columns,
  columnOrder,
  setColumnOrder,
  hideColumn,
  showColumn,
  children,
  isOpen,
  onClose,
}): ReactElement => {
  const scrollbarGutterSize = useScrollbarGutterSize()

  const { refs, floatingStyles, context } = useFloatingOverlay({
    open: isOpen,
    placement: "bottom-end",
    offsetPx: COLUMN_MENU_OFFSET,
  })

  // useOverlayDismissal provides click-outside and Escape handlers.
  // setReferenceRef (passed to the wrapper div below) excludes the trigger from
  // outside-click detection, preventing double-close with the parent's toggle handler.
  const { panelRef, setFloatingRef, setReferenceRef } = useOverlayDismissal({
    isOpen,
    onClose,
    floatingSetFn: refs.setFloating,
    referenceSetFn: refs.setReference,
  })

  // Determine column visibility based on hidden property and column order:
  const isColumnVisible = (c: BaseColumn): boolean =>
    !(c.isHidden === true || isHiddenViaColumnOrder(c, columnOrder))

  const allChecked = columns.every(isColumnVisible)
  const isIndeterminate = columns.some(isColumnVisible) && !allChecked

  const onSelectAll = (checked: boolean): void => {
    columns.forEach(column => {
      const hiddenViaColumnOrder = isHiddenViaColumnOrder(column, columnOrder)

      // Default behavior of the indeterminate state will select all.
      if (checked) {
        showColumn(column.id)
        if (hiddenViaColumnOrder) {
          // Add the column to the column order list:
          setColumnOrder((prevColumnOrder: string[]) => [
            ...prevColumnOrder,
            column.id,
          ])
        }
      } else {
        hideColumn(column.id)
      }
    })
  }

  return (
    <div ref={setReferenceRef}>
      {children}
      {isOpen && (
        <DataFrameOverlayPortal>
          <FloatingFocusManager context={context} initialFocus={panelRef}>
            <StyledColumnVisibilityMenuPanel
              ref={setFloatingRef}
              style={floatingStyles}
              tabIndex={-1}
              data-testid="stDataFrameColumnVisibilityMenu"
            >
              <StyledColumnVisibilityMenuContent
                style={
                  {
                    // Pass scrollbar gutter size to children via CSS custom property
                    "--scrollbar-gutter-size": `${scrollbarGutterSize}px`,
                  } as React.CSSProperties
                }
              >
                <CheckboxItem
                  label={"Select all"}
                  isIndeterminate={isIndeterminate}
                  initialValue={allChecked}
                  onChange={checked => {
                    onSelectAll(checked)
                  }}
                />
                <StyledMenuDivider />
                <div>
                  {columns.map(column => {
                    const hiddenViaColumnOrder = isHiddenViaColumnOrder(
                      column,
                      columnOrder
                    )

                    return (
                      <CheckboxItem
                        key={column.id}
                        label={
                          !column.title && column.isIndex
                            ? NAMELESS_INDEX_NAME
                            : column.title
                        }
                        initialValue={
                          !(column.isHidden === true || hiddenViaColumnOrder)
                        }
                        onChange={checked => {
                          if (checked) {
                            showColumn(column.id)
                            if (hiddenViaColumnOrder) {
                              // Add the column to the column order list:
                              setColumnOrder((prevColumnOrder: string[]) => [
                                ...prevColumnOrder,
                                column.id,
                              ])
                            }
                          } else {
                            hideColumn(column.id)
                          }
                        }}
                      />
                    )
                  })}
                </div>
              </StyledColumnVisibilityMenuContent>
            </StyledColumnVisibilityMenuPanel>
          </FloatingFocusManager>
        </DataFrameOverlayPortal>
      )}
    </div>
  )
}

export default memo(ColumnVisibilityMenu)
