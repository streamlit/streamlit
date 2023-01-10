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

import React from "react"

import {
  GridColumn,
  GridCell,
  DataEditorProps,
} from "@glideapps/glide-data-grid"
import { useColumnSort as useGlideColumnSort } from "@glideapps/glide-data-grid-source"

import { BaseColumn, toGlideColumn } from "../columns"

/**
 * Configuration type for column sorting hook.
 */
type ColumnSortConfig = {
  column: GridColumn
  mode?: "default" | "raw" | "smart"
  direction?: "asc" | "desc"
}

/**
 * Updates the column headers based on the sorting configuration.
 *
 * @param columns - The columns of the table.
 * @param sort - The current sorting configuration.
 *
 * @returns The updated list of columns.
 */
function updateSortingHeader(
  columns: BaseColumn[],
  sort: ColumnSortConfig | undefined
): BaseColumn[] {
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

type ColumnSortReturn = {
  columns: BaseColumn[]
  sortColumn: (index: number) => void
  getOriginalIndex: (index: number) => number
} & Pick<DataEditorProps, "getCellContent">

/**
 * A React hook that provides column sorting functionality.
 *
 * @param numRows - The number of rows in the table.
 * @param columns - The columns of the table.
 *
 * @returns An object containing the following properties:
 * - `columns`: The updated list of columns.
 * - `sortColumn`: A function that sorts the column at the given index.
 * - `getOriginalIndex`: A function that returns the original index of the row at the given index.
 * - `getCellContent`: An updated function that returns the content of the cell at the given column and row indices.
 */
function useColumnSort(
  numRows: number,
  columns: BaseColumn[],
  getCellContent: ([col, row]: readonly [number, number]) => GridCell
): ColumnSortReturn {
  const [sort, setSort] = React.useState<ColumnSortConfig>()

  const { getCellContent: getCellContentSorted, getOriginalIndex } =
    useGlideColumnSort({
      columns: columns.map(column => toGlideColumn(column)),
      getCellContent,
      rows: numRows,
      sort,
    })

  const updatedColumns = updateSortingHeader(columns, sort)

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
        column: toGlideColumn(clickedColumn),
        direction: sortDirection,
        mode: clickedColumn.sortMode,
      } as ColumnSortConfig)
    },
    [sort, updatedColumns]
  )

  return {
    columns: updatedColumns,
    sortColumn,
    getOriginalIndex,
    getCellContent: getCellContentSorted,
  }
}

export default useColumnSort
