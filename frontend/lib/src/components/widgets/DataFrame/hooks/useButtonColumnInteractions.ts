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
  type DataEditorProps,
  type GridCell,
  GridCellKind,
  type Rectangle,
} from "@glideapps/glide-data-grid"

import type { Dataframe as DataframeProto } from "@streamlit/protobuf"

import type { WidgetStateManager } from "~lib/WidgetStateManager"

import type { BaseColumn } from "../columns"
import type { ButtonCell } from "../columns/cells/ButtonCell"

import { COLUMN_POSITION_PREFIX } from "./useColumnLoader"

type ButtonMenuBounds = Rectangle & { clickX: number; clickY: number }

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
}

interface UseButtonColumnInteractionsReturn {
  getCellContent: DataEditorProps["getCellContent"]
  buttonActionMenu: ButtonActionMenuState | undefined
  clearButtonActionMenu: () => void
  handleMenuSelectAction: (label: string) => void
}

function isButtonCell(cell: GridCell): cell is ButtonCell {
  return (
    cell.kind === GridCellKind.Custom &&
    (cell.data as Record<string, unknown>)?.kind === "button-cell"
  )
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
  getCellContent: getBaseCellContent,
  getOriginalIndex,
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

      if (!widgetMgr) return

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

  const getCellContent = useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      const cell = getBaseCellContent([col, row])

      if (!isButtonCell(cell)) {
        return cell
      }

      const column = columns[col]
      // Look up widget ID by column name or positional key (_pos:<index>).
      const positionalKey = `${COLUMN_POSITION_PREFIX}${column.indexNumber}`
      const matchedKey =
        element.buttonClickWidgets[column.name] !== undefined
          ? column.name
          : positionalKey
      const widgetId = element.buttonClickWidgets[matchedKey]

      if (!widgetId) {
        return cell
      }

      const originalRowIndex = getOriginalIndex(row)

      return {
        ...cell,
        data: {
          ...cell.data,
          rowIndex: originalRowIndex,
          onClick: (rowIdx: number, label: string) => {
            handleButtonClick(matchedKey, rowIdx, label)
          },
          onOpenMenu: (
            rowIdx: number,
            actions: string[],
            bounds: ButtonMenuBounds
          ) => {
            handleOpenButtonMenu(matchedKey, rowIdx, actions, bounds)
          },
        },
      }
    },
    [
      getBaseCellContent,
      columns,
      element.buttonClickWidgets,
      getOriginalIndex,
      handleButtonClick,
      handleOpenButtonMenu,
    ]
  )

  return {
    getCellContent,
    buttonActionMenu,
    clearButtonActionMenu,
    handleMenuSelectAction,
  }
}

export default useButtonColumnInteractions
