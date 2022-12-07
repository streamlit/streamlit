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
  GridCell,
  GridColumn,
  DataEditorProps,
} from "@glideapps/glide-data-grid"
import { useColumnSort } from "@glideapps/glide-data-grid-source"
import { useTheme } from "@emotion/react"
import { transparentize } from "color2k"

import { Quiver } from "src/lib/Quiver"
import { logError } from "src/lib/log"
import { Arrow as ArrowProto } from "src/autogen/proto"
import { notNullOrUndefined } from "src/lib/utils"
import { Theme } from "src/theme"

import {
  getColumnTypeFromConfig,
  CustomColumn,
  getTextCell,
  getErrorCell,
  isEditableType,
  getColumnSortMode,
} from "./DataFrameCells"
import { getCellFromQuiver, getColumnsFromQuiver } from "./quiverUtils"

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
type DataLoaderReturn = {
  numRows: number
  sortColumn: (index: number) => void
  getOriginalIndex: (index: number) => number
  columns: CustomColumn[]
} & Pick<DataEditorProps, "getCellContent" | "onColumnResize">

/**
 * A custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 * And features that influence the data representation and column configuration
 * such as column resizing, sorting, etc.
 */
function useDataLoader(
  element: ArrowProto,
  data: Quiver,
  disabled: boolean
): DataLoaderReturn {
  const theme: Theme = useTheme()

  // Number of rows of the table minus 1 for the header row:
  const numRows = data.isEmpty() ? 1 : data.dimensions.rows - 1

  const [sort, setSort] = React.useState<ColumnSortConfig>()

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
        // Deactivate grow whenever a column gets manually resized
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
      const originalRow = row
      //getOriginalIndex(row)

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
    [sizedColumns, numRows, data]
  )

  const { getCellContent: getCellContentSorted, getOriginalIndex } =
    useColumnSort({
      columns: sizedColumns,
      getCellContent,
      rows: numRows,
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

  return {
    numRows,
    sortColumn,
    getOriginalIndex,
    columns: updatedColumns,
    getCellContent: getCellContentSorted,
    onColumnResize,
  }
}

export default useDataLoader
