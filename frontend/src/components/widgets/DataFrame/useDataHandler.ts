/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, { useState } from "react"
import {
  EditableGridCell,
  GridCell,
  GridColumn,
  DataEditorProps,
  DataEditorRef,
  GridSelection,
  Item,
} from "@glideapps/glide-data-grid"
import { useColumnSort } from "@glideapps/glide-data-grid-source"
import { useTheme } from "@emotion/react"
import { transparentize } from "color2k"

import { Quiver } from "src/lib/Quiver"
import { logError } from "src/lib/log"
import { Arrow as ArrowProto } from "src/autogen/proto"
import { debounce } from "src/lib/utils"
import { notNullOrUndefined } from "src/lib/utils"
import { Theme } from "src/theme"

import {
  getColumnTypeFromConfig,
  CustomColumn,
  getTextCell,
  getErrorCell,
  isEditableType,
  getCell,
  isErrorCell,
  getCellValue,
  getColumnSortMode,
} from "./DataFrameCells"
import { getCellFromQuiver, getColumnsFromQuiver } from "./quiverUtils"

import "@glideapps/glide-data-grid/dist/index.css"
import { WidgetInfo, WidgetStateManager } from "src/lib/WidgetStateManager"

// Debounce time for triggering a widget state update
// This prevents to rapid updates to the widget state.
const DEBOUNCE_TIME_MS = 100

/**
 * Options to configure columns.
 */
interface ColumnConfigProps {
  width?: number
  title?: string
  type?: string
  hidden?: boolean
  editable?: boolean
  metadata?: Record<string, unknown>
  alignment?: string
}

/**
 * Configuration type for column sorting hook.
 */
type ColumnSortConfig = {
  column: GridColumn
  mode?: "default" | "raw" | "smart"
  direction?: "asc" | "desc"
}

/**
 * The editing state of the DataFrame.
 */
class EditingState {
  // row -> column -> GridCell
  // Using [number, number] as a key for a Map would not work.
  private editedCells: Map<number, Map<number, GridCell>> = new Map()
  // List of rows represented by of column -> GridCell mappings
  private addedRows: Array<Map<number, GridCell>> = new Array()
  private deletedRows: number[] = new Array()
  private numRows: number = 0

  constructor(numRows: number) {
    this.numRows = numRows
  }

  toJson(columns: CustomColumn[]): string {
    const columnsByIndex = new Map<number, CustomColumn>()
    columns.forEach(column => {
      columnsByIndex.set(column.indexNumber, column)
    })

    const currentState = {
      edited_cells: {} as Record<string, any>,
      added_rows: [] as Map<number, any>[],
      deleted_rows: [] as number[],
    }

    this.editedCells.forEach(
      (row: Map<number, GridCell>, rowIndex: number, _map) => {
        row.forEach((cell: GridCell, colIndex: number, _map) => {
          const column = columnsByIndex.get(colIndex)
          if (column) {
            currentState.edited_cells[`${colIndex}:${rowIndex}`] =
              getCellValue(column, cell)
          }
        })
      }
    )

    // TODO(lukasmasuch): Support adding rows
    // this.addedRows.forEach((row: Map<number, GridCell>) => {
    //   currentState.edited_cells.push(row[0])
    // })

    currentState.deleted_rows = this.deletedRows
    // Convert undefined values to null, otherwise this is removed here since
    // undefined does not exist in JSON.
    return JSON.stringify(currentState, (k, v) => (v === undefined ? null : v))
  }

  isAddedRow(row: number): boolean {
    return row >= this.numRows
  }

  getCell(col: number, row: number): GridCell | undefined {
    if (this.isAddedRow(row)) {
      // Added rows have their own editing state
      return this.addedRows[row - this.numRows].get(col)
    }

    const rowCache = this.editedCells.get(row)
    if (rowCache === undefined) {
      return undefined
    }

    return rowCache.get(col)
  }

  setCell(col: number, row: number, cell: GridCell): void {
    console.log(
      "setCell",
      col,
      row,
      cell,
      this.editedCells,
      this.addedRows,
      this.isAddedRow(row)
    )
    if (this.isAddedRow(row)) {
      if (row - this.numRows >= this.addedRows.length) {
        // Added row does not exist. This is only expected to happen
        // in relation to a trailing row issue in glide-data-grid.
        return
      }
      // Added rows have their own editing state
      this.addedRows[row - this.numRows].set(col, cell)
    } else {
      if (this.editedCells.get(row) === undefined) {
        this.editedCells.set(row, new Map())
      }

      const rowCache = this.editedCells.get(row) as Map<number, GridCell>
      rowCache.set(col, cell)
    }
  }

  addRow(rowCells: Map<number, GridCell>): void {
    this.addedRows.push(rowCells)
  }

  deleteRows(rows: number[]): void {
    rows
      .sort((a, b) => b - a)
      .forEach(row => {
        this.deleteRow(row)
      })
  }

  deleteRow(row: number): void {
    if (!notNullOrUndefined(row) || row < 0) {
      // This should never happen
      return
    }

    if (this.isAddedRow(row)) {
      // Remove from added rows:
      this.addedRows.splice(row - this.numRows, 1)
      // there is nothing more we have to do
      return
    }

    if (!this.deletedRows.includes(row)) {
      // Add to the set and sort the deleted rows (important for calculation of the original row index)
      this.deletedRows.push(row)

      this.deletedRows = this.deletedRows.sort()
    }

    // Remove all cells from cell state associated with this row:
    this.editedCells.delete(row)
  }

  getOriginalRowIndex(row: number): number {
    // Just count all deleted rows before this row to determine the original row index:
    let originalIndex = row
    for (let i = 0; i < this.deletedRows.length; i++) {
      if (this.deletedRows[i] > originalIndex) {
        break
      }
      originalIndex += 1
    }
    return originalIndex
  }

  getNumRows(): number {
    return this.numRows + this.addedRows.length - this.deletedRows.length
  }
}

/**
 * Apply the column configuration if supplied.
 */
function applyColumnConfig(
  column: CustomColumn,
  columnsConfig: Map<string | number, ColumnConfigProps>
): CustomColumn {
  if (!columnsConfig) {
    // No column config configured
    return column
  }

  let columnConfig
  if (columnsConfig.has(column.title)) {
    columnConfig = columnsConfig.get(column.title)
  } else if (columnsConfig.has(`index:${column.indexNumber}`)) {
    columnConfig = columnsConfig.get(`index:${column.indexNumber}`)
  }

  if (!columnConfig) {
    // No column config found for this column
    return column
  }

  return {
    ...column,
    // Update title:
    ...(notNullOrUndefined(columnConfig.title)
      ? {
          title: columnConfig.title,
        }
      : {}),

    // Update width:
    ...(notNullOrUndefined(columnConfig.width)
      ? {
          width: columnConfig.width,
        }
      : {}),
    // Update data type:
    ...(notNullOrUndefined(columnConfig.type)
      ? {
          columnType: getColumnTypeFromConfig(columnConfig.type),
        }
      : {}),
    // Update editable state:
    ...(notNullOrUndefined(columnConfig.editable)
      ? {
          isEditable: columnConfig.editable,
        }
      : {}),
    // Update hidden state:
    ...(notNullOrUndefined(columnConfig.hidden)
      ? {
          isHidden: columnConfig.hidden,
        }
      : {}),
    // Add column type metadata:
    ...(notNullOrUndefined(columnConfig.metadata)
      ? {
          //TODO(lukasmasuch): Merge in metadata?
          columnTypeMetadata: columnConfig.metadata,
        }
      : {}),
    // Add column alignment:
    ...(notNullOrUndefined(columnConfig.alignment) &&
    ["left", "center", "right"].includes(columnConfig.alignment)
      ? {
          contentAlignment: columnConfig.alignment,
        }
      : {}),
  } as CustomColumn
}

/**
 * Updates the column headers based on the sorting configuration.
 */
function updateSortingHeader(
  columns: CustomColumn[],
  sort: ColumnSortConfig | undefined
): CustomColumn[] {
  if (sort === undefined) {
    return columns
  }
  return columns.map(column => {
    if (column.id === sort.column.id) {
      return {
        ...column,
        title:
          sort.direction === "asc" ? `↑ ${column.title}` : `↓ ${column.title}`,
      }
    }
    return column
  })
}

function getColumnConfig(element: ArrowProto): Map<string, any> {
  if (!element.columns) {
    return new Map()
  }
  try {
    return new Map(Object.entries(JSON.parse(element.columns)))
  } catch (error) {
    // This is not expected to happen, but if it does, we'll return an empty map
    // and log the error to the console.
    logError(error)
    return new Map()
  }
}

/**
 * Create return type for useDataLoader hook based on the DataEditorProps.
 */
type DataHandlerReturn = {
  numRows: number
  resetEditingState: () => void
  sortColumn: (index: number) => void
} & Pick<
  DataEditorProps,
  | "columns"
  | "getCellContent"
  | "onColumnResize"
  | "onCellEdited"
  | "onPaste"
  | "onRowAppended"
  | "onDelete"
>

/**
 * A custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 * And features that influence the data representation and column configuration
 * such as column resizing, sorting, etc.
 */
function useDataHandler(
  widgetMgr: WidgetStateManager,
  dataEditorRef: React.RefObject<DataEditorRef>,
  element: ArrowProto,
  data: Quiver,
  disabled: boolean,
  clearSelection: () => void
): DataHandlerReturn {
  const theme: Theme = useTheme()

  // Number of rows of the table minus 1 for the header row:
  const originalNumRows = data.isEmpty() ? 1 : data.dimensions.rows - 1
  const editingState = React.useRef<EditingState>(
    new EditingState(originalNumRows)
  )

  const [sort, setSort] = React.useState<ColumnSortConfig>()
  const [numRows, setNumRows] = useState(editingState.current.getNumRows())

  React.useEffect(() => {
    editingState.current = new EditingState(originalNumRows)
    setNumRows(editingState.current.getNumRows())
  }, [originalNumRows])

  const resetEditingState = React.useCallback(() => {
    editingState.current = new EditingState(originalNumRows)
    setNumRows(editingState.current.getNumRows())
  }, [originalNumRows])

  // TODO(lukasmasuch): This should be also dependent on element or data
  // But this currently triggers updates on every rerender.

  // The columns with the corresponding empty template for every type:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [columnSizes, setColumnSizes] = useState<Map<string, number>>(
    () => new Map()
  )

  // TODO(lukasmasuch): Use state here for optimization?
  const columnsConfig = getColumnConfig(element)

  /**
   * Returns a list of glide-data-grid compatible columns based on a Quiver instance.
   */
  // TODO(lukasmasuch): Does this need to be a callback?
  const getColumns = React.useCallback((): CustomColumn[] => {
    const columns: CustomColumn[] = getColumnsFromQuiver(data)
    const stretchColumns: boolean =
      element.useContainerWidth ||
      (notNullOrUndefined(element.width) && element.width > 0)

    // Apply configurations:
    return columns.map(column => {
      if (column.isIndex) {
        let updatedColumn = applyColumnConfig(column, columnsConfig)
        // TODO(lukasmasuch): Editing for index columns is currently not supported.
        // Deactivate even if it gets activated in the column config.
        updatedColumn.isEditable = false

        // Apply column stretch
        if (stretchColumns) {
          updatedColumn = {
            ...updatedColumn,
            grow: 1,
          }
        }

        return updatedColumn
      } else {
        let updatedColumn = applyColumnConfig(column, columnsConfig)

        // Check if we need to deactivate editing:
        if (
          element.editingMode === ArrowProto.EditingMode.READ_ONLY ||
          disabled ||
          !isEditableType(updatedColumn.columnType)
        ) {
          updatedColumn.isEditable = false
        }

        // Apply column stretch
        if (stretchColumns) {
          updatedColumn = {
            ...updatedColumn,
            grow: 3,
          }
        }

        if (
          element.editingMode !== ArrowProto.EditingMode.READ_ONLY &&
          !updatedColumn.isEditable
        ) {
          updatedColumn = {
            ...updatedColumn,
            themeOverride: {
              bgCell: transparentize(theme.colors.darkenedBgMix100, 0.95),
              bgCellMedium: transparentize(
                theme.colors.darkenedBgMix100,
                0.95
              ),
            },
          }
        }

        return updatedColumn
      }
    })
  }, [element, disabled, data, columnsConfig])

  // Filter out all columns that are hidden:
  const visibleColumns = getColumns().filter(column => {
    return !column.isHidden
  })

  // Apply column widths from state:
  const sizedColumns = visibleColumns.map(column => {
    if (
      column.id &&
      columnSizes.has(column.id) &&
      columnSizes.get(column.id) !== undefined
    ) {
      return {
        ...column,
        width: columnSizes.get(column.id),
        // Deactivate grow whenever a column gets manually resized:
        grow: 0,
      } as CustomColumn
    }
    return column
  })

  const onColumnResize = React.useCallback(
    (
      column: GridColumn,
      _newSize: number,
      _colIndex: number,
      newSizeWithGrow: number
    ) => {
      if (column.id) {
        setColumnSizes(new Map(columnSizes).set(column.id, newSizeWithGrow))
      }
    },
    [sizedColumns]
  )

  const getCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      if (data.isEmpty()) {
        // TODO(lukasmasuch): Is this still needed for editable tables?
        return {
          ...getTextCell(true, true),
          displayData: "empty",
        } as GridCell
      }

      if (col > sizedColumns.length - 1) {
        return getErrorCell(
          "Column index out of bounds.",
          "This should never happen. Please report this bug."
        )
      }

      if (row > numRows - 1) {
        return getErrorCell(
          "Row index out of bounds.",
          "This should never happen. Please report this bug."
        )
      }
      const column = sizedColumns[col]

      const originalCol = column.indexNumber
      const originalRow = editingState.current.getOriginalRowIndex(row)
      // Use editing state if editable or if it is an appended row
      if (column.isEditable || editingState.current.isAddedRow(originalRow)) {
        const editedCell = editingState.current.getCell(
          originalCol,
          originalRow
        )
        if (editedCell !== undefined) {
          return editedCell
        }
      }

      try {
        // Quiver has the header in first row
        const quiverCell = data.getCell(originalRow + 1, originalCol)
        return getCellFromQuiver(column, quiverCell, data.cssStyles)
      } catch (error) {
        logError(error)
        return getErrorCell(
          "Error during cell creation.",
          `This should never happen. Please report this bug. \nError: ${error}`
        )
      }
    },
    [sizedColumns, numRows, data, editingState]
  )

  const onRowAppended = React.useCallback(() => {
    const newRow: Map<number, GridCell> = new Map()
    sizedColumns.forEach(column => {
      newRow.set(column.indexNumber, getCell(column, undefined))
    })
    editingState.current.addRow(newRow)
    setNumRows(editingState.current.getNumRows())
  }, [sizedColumns, editingState])

  const { getCellContent: getCellContentSorted, getOriginalIndex } =
    useColumnSort({
      columns: sizedColumns,
      getCellContent,
      rows: editingState.current.getNumRows(),
      sort,
    })

  const updatedColumns = updateSortingHeader(sizedColumns, sort)

  const sortColumn = React.useCallback(
    (index: number) => {
      let sortDirection = "asc"
      const clickedColumn = updatedColumns[index]

      if (sort && sort.column.id === clickedColumn.id) {
        // The clicked column is already sorted
        if (sort.direction === "asc") {
          // Sort column descending
          sortDirection = "desc"
        } else {
          // Remove sorting of column
          setSort(undefined)
          return
        }
      }

      setSort({
        column: clickedColumn,
        direction: sortDirection,
        mode: getColumnSortMode((clickedColumn as CustomColumn).columnType),
      } as ColumnSortConfig)
    },
    [sort, updatedColumns]
  )

  const triggerUpdate = React.useCallback(
    debounce(DEBOUNCE_TIME_MS, () => {
      const currentStateStr = editingState.current.toJson(updatedColumns)
      let widgetStateStr = widgetMgr.getStringValue(element as WidgetInfo)

      if (widgetStateStr === undefined) {
        const emptyState = {
          edited_cells: {} as Map<string, any>,
          added_rows: [] as Map<number, any>[],
          deleted_rows: [] as number[],
        }
        widgetStateStr = JSON.stringify(emptyState)
      }

      if (currentStateStr !== widgetStateStr) {
        // Only update if there is actually a difference
        widgetMgr.setStringValue(element as WidgetInfo, currentStateStr, {
          fromUi: true,
        })
      }
    }),
    [editingState, updatedColumns, widgetMgr, element]
  )

  const onCellEdited = React.useCallback(
    (
      [col, row]: readonly [number, number],
      updatedCell: EditableGridCell
    ): void => {
      console.log("onCellEdited", col, row, updatedCell)
      const column = updatedColumns[col]

      const originalCol = column.indexNumber
      const originalRow = editingState.current.getOriginalRowIndex(
        getOriginalIndex(row)
      )
      const currentValue = getCellValue(
        column,
        getCellContentSorted([col, row])
      )
      const newValue = getCellValue(column, updatedCell)
      if (newValue === currentValue) {
        // No editing is required since the values did not change
        return
      }

      const newCell = getCell(column, newValue)

      editingState.current.setCell(originalCol, originalRow, {
        ...newCell,
        lastUpdated: performance.now(),
      })

      triggerUpdate()
    },
    [getOriginalIndex, editingState, updatedColumns, sort]
  )

  const onDelete = React.useCallback(
    (selection: GridSelection): GridSelection | boolean => {
      if (selection.rows.length > 0) {
        const rowsToDelete = selection.rows.toArray().map(row => {
          return editingState.current.getOriginalRowIndex(
            getOriginalIndex(row)
          )
        })
        // We need to delete all rows at once, so that the indexes work correct
        editingState.current.deleteRows(rowsToDelete)
        setNumRows(editingState.current.getNumRows())
        clearSelection()
        triggerUpdate()
        return false
      }
      if (selection.current?.range) {
        const updatedCells: { cell: [number, number] }[] = []
        const selected_area = selection.current.range
        for (
          let row = selected_area.y;
          row < selected_area.y + selected_area.height;
          row++
        ) {
          for (
            let col = selected_area.x;
            col < selected_area.x + selected_area.width;
            col++
          ) {
            const column = updatedColumns[col]
            if (column.isEditable) {
              updatedCells.push({
                cell: [col, row],
              })
              onCellEdited(
                [col, row],
                getCell(column, undefined) as EditableGridCell
              )
            }
          }
        }
        triggerUpdate()
        dataEditorRef.current?.updateCells(updatedCells)
        return false
      }
      return true
    },
    [getOriginalIndex, editingState, sort]
  )

  const onPaste = React.useCallback(
    (target: Item, values: readonly (readonly string[])[]): boolean => {
      const [targetCol, targetRow] = target

      const updatedCells: { cell: [number, number] }[] = []

      for (let row = 0; row < values.length; row++) {
        const rowData = values[row]
        if (row + targetRow >= numRows) {
          if (element.editingMode !== ArrowProto.EditingMode.DYNAMIC) {
            // Only add new rows if editing mode is dynamic, otherwise break here
            break
          }
          if (sort) {
            // Sorting and adding appending new rows via paste is currently
            // not compatible because the sort index isn't updated.
            break
          }
          onRowAppended()
        }
        for (let col = 0; col < rowData.length; col++) {
          const pasteDataValue = rowData[col]

          const rowIndex = row + targetRow
          const colIndex = col + targetCol

          if (colIndex >= updatedColumns.length) {
            // We could potentially add new columns here in the future.
            break
          }

          const column = updatedColumns[colIndex]

          if (!column.isEditable) {
            // Column is not editable -> just ignore
            continue
          }

          const newCell = getCell(column, pasteDataValue)
          if (isErrorCell(newCell)) {
            // If new cell value leads to error -> just ignore
            continue
          }

          const originalCol = column.indexNumber
          const originalRow = editingState.current.getOriginalRowIndex(
            getOriginalIndex(rowIndex)
          )

          const currentValue = getCellValue(
            column,
            getCellContentSorted([colIndex, rowIndex])
          )

          const newValue = getCellValue(column, newCell)
          if (newValue === currentValue) {
            // No editing is required since the values did not change
            continue
          }

          editingState.current.setCell(originalCol, originalRow, {
            ...newCell,
            lastUpdated: performance.now(),
          })

          updatedCells.push({
            cell: [colIndex, rowIndex],
          })
        }

        triggerUpdate()
        dataEditorRef.current?.updateCells(updatedCells)
      }

      return false
    },
    [
      updatedColumns,
      numRows,
      getOriginalIndex,
      editingState,
      dataEditorRef,
      sort,
    ]
  )

  return {
    numRows,
    resetEditingState,
    sortColumn,
    columns: updatedColumns,
    getCellContent: getCellContentSorted,
    onColumnResize,
    onCellEdited,
    onPaste,
    onRowAppended,
    onDelete,
  }
}

export default useDataHandler
