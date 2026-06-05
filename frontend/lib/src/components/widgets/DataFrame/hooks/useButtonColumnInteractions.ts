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

import { useCallback, useEffect, useRef, useState } from "react"

import {
  type CellClickedEventArgs,
  type DataEditorProps,
  type Item,
} from "@glideapps/glide-data-grid"

import type { Dataframe as DataframeProto } from "@streamlit/protobuf"

import type { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import {
  type ButtonInteractionTheme,
  type ButtonMenuBounds,
  getButtonCellClickTarget,
  isButtonCell,
} from "~lib/components/widgets/DataFrame/columns/cells/ButtonCell"
import {
  COLUMN_POSITION_PREFIX,
  INDEX_IDENTIFIER,
} from "~lib/components/widgets/DataFrame/hooks/useColumnLoader"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

interface ButtonActionMenuState {
  /** The column name or positional key of the button column. */
  columnName: string
  /** The row index in the original data before sorting. */
  rowIndex: number
  /** The list of action labels to display in the dropdown. */
  actions: string[]
  /** Screen position for the menu in viewport coordinates. */
  screenTop: number
  screenLeft: number
}

interface UseButtonColumnInteractionsParams {
  element: DataframeProto
  widgetMgr: WidgetStateManager | undefined
  fragmentId?: string
  columns: BaseColumn[]
  getCellContent: DataEditorProps["getCellContent"]
  getOriginalIndex: (index: number) => number
  theme: ButtonInteractionTheme
  /** Whether the dataframe is disabled. Disables button clicks and menus. */
  disabled: boolean
}

interface UseButtonColumnInteractionsReturn {
  buttonActionMenu: ButtonActionMenuState | undefined
  clearButtonActionMenu: () => void
  handleMenuSelectAction: (label: string) => void
  onCellClicked: NonNullable<DataEditorProps["onCellClicked"]>
}

function getButtonWidgetKey(
  column: BaseColumn,
  buttonClickWidgets: DataframeProto["buttonClickWidgets"]
): string | undefined {
  // Resolve the widget key the same way the backend registers button-column
  // widgets: index columns are stored under the `_index` identifier, while data
  // columns use their name or positional key (`_pos:{index}`).
  const candidateKeys = [
    ...(column.isIndex ? [INDEX_IDENTIFIER] : []),
    column.name,
    `${COLUMN_POSITION_PREFIX}${column.indexNumber}`,
  ]

  return candidateKeys.find(key => Boolean(buttonClickWidgets[key]))
}

/**
 * Handles button-column widget events and multi-action menu state.
 *
 * Button cells are rendered by the custom cell renderer, but their click
 * behavior depends on dataframe runtime state: sorted row indices, widget IDs,
 * form IDs, and fragment IDs. This hook keeps that wiring out of DataFrame.tsx.
 */
function useButtonColumnInteractions({
  element,
  widgetMgr,
  fragmentId,
  columns,
  getCellContent,
  getOriginalIndex,
  theme,
  disabled,
}: UseButtonColumnInteractionsParams): UseButtonColumnInteractionsReturn {
  const [buttonActionMenu, setButtonActionMenu] =
    useState<ButtonActionMenuState>()

  const menuRafRef = useRef<number | null>(null)

  const cancelPendingMenuOpen = useCallback((): void => {
    if (menuRafRef.current !== null) {
      cancelAnimationFrame(menuRafRef.current)
      menuRafRef.current = null
    }
  }, [])

  const clearButtonActionMenu = useCallback((): void => {
    cancelPendingMenuOpen()
    setButtonActionMenu(undefined)
  }, [cancelPendingMenuOpen])

  // Ref to access current menu state in stable callbacks without
  // re-creating them when menu state changes.
  const buttonActionMenuRef = useRef(buttonActionMenu)
  buttonActionMenuRef.current = buttonActionMenu

  useEffect(() => {
    return () => {
      cancelPendingMenuOpen()
    }
  }, [cancelPendingMenuOpen])

  const handleButtonClick = useCallback(
    (columnName: string, rowIndex: number, label: string): void => {
      clearButtonActionMenu()

      if (disabled || !widgetMgr) return

      const widgetId = element.buttonClickWidgets[columnName]
      if (!widgetId) return

      const clickState = JSON.stringify({ row: rowIndex, label })
      widgetMgr.setStringTriggerValue(
        { id: widgetId, formId: element.formId },
        clickState,
        { fromUi: true },
        fragmentId
      )
    },
    [
      clearButtonActionMenu,
      disabled,
      widgetMgr,
      element.buttonClickWidgets,
      element.formId,
      fragmentId,
    ]
  )

  const handleMenuSelectAction = useCallback(
    (label: string): void => {
      const menu = buttonActionMenuRef.current
      if (menu) {
        handleButtonClick(menu.columnName, menu.rowIndex, label)
      }
    },
    [handleButtonClick]
  )

  const handleOpenButtonMenu = useCallback(
    (
      columnName: string,
      rowIndex: number,
      actions: string[],
      bounds: ButtonMenuBounds
    ): void => {
      cancelPendingMenuOpen()

      // When clicking between menu items or buttons, we need a clean transition.
      // The frame boundary forces BaseUI's Popover to remount at the new click
      // coordinates instead of reusing stale positioning from the previous menu.
      setButtonActionMenu(undefined)
      menuRafRef.current = requestAnimationFrame(() => {
        menuRafRef.current = null
        setButtonActionMenu({
          columnName,
          rowIndex,
          actions,
          screenTop: bounds.clickY,
          screenLeft: bounds.clickX,
        })
      })
    },
    [cancelPendingMenuOpen]
  )

  // Some grid-internal clicks are handled by Glide and do not reliably reach
  // ButtonActionMenu's document-level outside-click listener.
  const clearButtonActionMenuForIgnoredClick = useCallback((): void => {
    if (
      buttonActionMenuRef.current !== undefined ||
      menuRafRef.current !== null
    ) {
      clearButtonActionMenu()
    }
  }, [clearButtonActionMenu])

  const onCellClicked = useCallback(
    ([col, row]: Item, event: CellClickedEventArgs): void => {
      if (disabled) {
        clearButtonActionMenuForIgnoredClick()
        return
      }

      const column = columns[col]
      if (column === undefined) {
        clearButtonActionMenuForIgnoredClick()
        return
      }

      const cell = getCellContent([col, row])
      if (!isButtonCell(cell)) {
        clearButtonActionMenuForIgnoredClick()
        return
      }

      const matchedKey = getButtonWidgetKey(column, element.buttonClickWidgets)

      if (matchedKey === undefined) {
        clearButtonActionMenuForIgnoredClick()
        return
      }

      const clickTarget = getButtonCellClickTarget(cell, {
        bounds: event.bounds,
        posX: event.localEventX,
        posY: event.localEventY,
        theme,
      })

      if (clickTarget === undefined) {
        clearButtonActionMenuForIgnoredClick()
        return
      }

      event.preventDefault()

      const originalRowIndex = getOriginalIndex(row)

      if (clickTarget.kind === "button") {
        handleButtonClick(matchedKey, originalRowIndex, clickTarget.label)
      } else {
        handleOpenButtonMenu(
          matchedKey,
          originalRowIndex,
          clickTarget.actions,
          clickTarget.bounds
        )
      }
    },
    [
      clearButtonActionMenuForIgnoredClick,
      columns,
      disabled,
      element.buttonClickWidgets,
      getCellContent,
      getOriginalIndex,
      handleButtonClick,
      handleOpenButtonMenu,
      theme,
    ]
  )

  return {
    buttonActionMenu,
    clearButtonActionMenu,
    handleMenuSelectAction,
    onCellClicked,
  }
}

export default useButtonColumnInteractions
