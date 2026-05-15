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

import { useCallback, useMemo, useState } from "react"

import {
  DataEditorProps,
  GridCell,
  GridColumn,
} from "@glideapps/glide-data-grid"

import { ISortState, SortState } from "@streamlit/protobuf"

import {
  BaseColumn,
  toGlideColumn,
} from "~lib/components/widgets/DataFrame/columns"

/**
 * Local sort configuration for updating headers.
 */
interface SortConfig {
  column: GridColumn
  direction: "asc" | "desc"
}

/**
 * Updates the column headers based on the sorting configuration.
 */
function updateSortingHeader(
  columns: BaseColumn[],
  sort: SortConfig | undefined
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

type LazySortReturn = {
  /** Columns with updated headers to reflect sort state. */
  columns: BaseColumn[]
  /** Function to sort by a column (triggers server-side sort). */
  sortColumn: (
    index: number,
    direction?: "asc" | "desc" | "auto",
    autoReset?: boolean
  ) => void
  /** Get original row index (identity for lazy since server handles sort). */
  getOriginalIndex: (index: number) => number
  /** The getCellContent function (unchanged, server handles sort order). */
  getCellContent: DataEditorProps["getCellContent"]
  /** Current sort state for communicating with cache. */
  currentSort: ISortState | null
}

/**
 * Hook for column sorting with server-side sorting support.
 *
 * Unlike useColumnSort which sorts client-side, this hook maintains sort state
 * that is used when fetching data from the server. The server returns pre-sorted
 * chunks, so we don't need to remap row indices.
 *
 * @param columns - The columns of the table.
 * @param getCellContent - The cell content getter from the lazy data loader.
 * @param onSortChange - Callback when sort state changes (to update the cache).
 */
function useLazyColumnSort(
  columns: BaseColumn[],
  getCellContent: ([col, row]: readonly [number, number]) => GridCell,
  onSortChange: (sort: ISortState | null) => void
): LazySortReturn {
  const [sortConfig, setSortConfig] = useState<SortConfig>()

  // Convert local sort config to proto sort state
  // Use the column name (not id) since the backend needs the actual column name
  const currentSort: ISortState | null = useMemo(() => {
    if (!sortConfig) {
      return null
    }
    // Find the column to get its name (id is the internal UI identifier)
    const column = columns.find(c => c.id === sortConfig.column.id)
    // If the column is not found (e.g., schema changed), return null (no sort)
    // to avoid sending an invalid column name to the backend
    if (!column) {
      return null
    }
    return {
      column: column.name,
      direction:
        sortConfig.direction === "desc"
          ? SortState.SortDirection.DESCENDING
          : SortState.SortDirection.ASCENDING,
    }
  }, [sortConfig, columns])

  const updatedColumns = useMemo(
    () => updateSortingHeader(columns, sortConfig),
    [columns, sortConfig]
  )

  const sortColumn = useCallback(
    (
      index: number,
      direction?: "asc" | "desc" | "auto",
      autoReset?: boolean
    ) => {
      const clickedColumn = columns[index]
      let sortDirection: "asc" | "desc" | undefined

      if (direction === "auto") {
        // Toggle from asc -> desc -> remove
        sortDirection = "asc"
        if (sortConfig?.column.id === clickedColumn.id) {
          if (sortConfig.direction === "asc") {
            sortDirection = "desc"
          } else {
            sortDirection = undefined
          }
        }
      } else {
        sortDirection = direction
      }

      let newConfig: SortConfig | undefined

      if (sortDirection === undefined) {
        newConfig = undefined
      } else if (autoReset && sortDirection === sortConfig?.direction) {
        newConfig = undefined
      } else {
        newConfig = {
          column: toGlideColumn(clickedColumn),
          direction: sortDirection,
        }
      }

      setSortConfig(newConfig)

      // Notify the cache of the sort change - use column name for backend
      if (newConfig) {
        onSortChange({
          column: clickedColumn.name,
          direction:
            newConfig.direction === "desc"
              ? SortState.SortDirection.DESCENDING
              : SortState.SortDirection.ASCENDING,
        })
      } else {
        onSortChange(null)
      }
    },
    [columns, sortConfig, onSortChange]
  )

  // For lazy dataframes, the server returns pre-sorted data,
  // so the original index is the same as the displayed index.
  const getOriginalIndex = useCallback((index: number): number => index, [])

  return {
    columns: updatedColumns,
    sortColumn,
    getOriginalIndex,
    getCellContent,
    currentSort,
  }
}

export default useLazyColumnSort
