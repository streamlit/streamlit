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

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"

/**
 * Server-side sort state for a lazy dataframe. `column` is the backend Arrow
 * schema column name (not the frontend UI id), which the backend source uses
 * to order rows.
 */
export interface LazySortState {
  column: string
  descending: boolean
}

interface InternalLazySort {
  /** Frontend column id (used for header indicator matching). */
  columnId: string
  /** Backend Arrow schema column name (sent to the server). */
  columnName: string
  direction: "asc" | "desc"
}

interface LazyColumnSortReturn {
  /** Columns with a sort-direction indicator applied to the active column. */
  columns: BaseColumn[]
  /** Toggle/apply the server-side sort for the column at the display index. */
  sortColumn: (
    index: number,
    direction?: "asc" | "desc" | "auto",
    autoReset?: boolean
  ) => void
  /**
   * Maps a display row index to the original row index. For lazy dataframes
   * this is the identity because rows are reordered server-side and selection
   * and editing are disabled.
   */
  getOriginalIndex: (index: number) => number
  /** The active sort state, or `undefined` when no column is sorted. */
  sortState: LazySortState | undefined
}

const identity = (index: number): number => index

/**
 * Manages server-side sort state for a lazy dataframe.
 *
 * Unlike the eager {@link useColumnSort} hook, this hook does not build a
 * client-side row mapping (which would require loading the entire table). It
 * only tracks the active sort column/direction and applies the header
 * indicator. The resulting {@link LazySortState} is passed to the lazy data
 * loader, which includes it in chunk requests so the server returns sorted
 * rows.
 */
function useLazyColumnSort(columns: BaseColumn[]): LazyColumnSortReturn {
  const [sort, setSort] = useState<InternalLazySort>()

  const updatedColumns = useMemo(() => {
    if (sort === undefined) {
      return columns
    }
    return columns.map(column => {
      if (column.id === sort.columnId) {
        return {
          ...column,
          title:
            sort.direction === "asc"
              ? `↑ ${column.title}`
              : `↓ ${column.title}`,
        }
      }
      return column
    })
  }, [columns, sort])

  const sortColumn = useCallback(
    (
      index: number,
      direction?: "asc" | "desc" | "auto",
      autoReset?: boolean
    ): void => {
      const clickedColumn = columns[index]
      if (clickedColumn === undefined) {
        return
      }

      // Server-side sorting keys on the backend Arrow field name. Columns
      // without one (e.g. the index column, whose name is empty) cannot be
      // sorted, so we ignore the request instead of showing a sort indicator
      // for a column that would silently stay unsorted.
      if (!clickedColumn.name) {
        return
      }

      let sortDirection: "asc" | "desc" | undefined
      if (direction === "auto") {
        // Toggle from asc -> desc -> remove on repeated clicks.
        sortDirection = "asc"
        if (sort?.columnId === clickedColumn.id) {
          sortDirection = sort.direction === "asc" ? "desc" : undefined
        }
      } else {
        sortDirection = direction
      }

      if (sortDirection === undefined) {
        setSort(undefined)
      } else if (
        autoReset &&
        sort?.columnId === clickedColumn.id &&
        sortDirection === sort?.direction
      ) {
        // Clicking the same direction again removes the sort.
        setSort(undefined)
      } else {
        setSort({
          columnId: clickedColumn.id,
          columnName: clickedColumn.name,
          direction: sortDirection,
        })
      }
    },
    [columns, sort]
  )

  const sortState = useMemo<LazySortState | undefined>(
    () =>
      sort === undefined
        ? undefined
        : { column: sort.columnName, descending: sort.direction === "desc" },
    [sort]
  )

  return {
    columns: updatedColumns,
    sortColumn,
    getOriginalIndex: identity,
    sortState,
  }
}

export default useLazyColumnSort
