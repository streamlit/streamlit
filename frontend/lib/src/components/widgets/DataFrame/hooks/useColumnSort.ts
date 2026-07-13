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

import { useCallback, useEffect, useMemo, useState } from "react"

import { DataEditorProps, GridCell } from "@glideapps/glide-data-grid"
import { useColumnSort as useGlideColumnSort } from "@glideapps/glide-data-grid-source"

import {
  BaseColumn,
  toGlideColumn,
} from "~lib/components/widgets/DataFrame/columns"

import {
  ActiveColumnSort,
  applySortIndicator,
  getNextColumnSort,
} from "./sortUtils"

/**
 * The sorting strategy for a dataframe:
 * - ``"client"``: sort all rows in the browser via Glide. Valid only for eager
 *   dataframes where every row is available locally.
 * - ``"server"``: only track sort state and the header indicator; the backend
 *   returns rows already sorted (lazy dataframes). The client-side sorter is
 *   never run over server rows.
 */
type ColumnSortMode = "client" | "server"

/**
 * Server-side sort state to send to the backend for lazy dataframes. ``column``
 * is the backend Arrow field name (not the displayed label).
 */
export interface ServerSortState {
  column: string
  descending: boolean
}

interface UseColumnSortParams {
  /** The sorting strategy (see {@link ColumnSortMode}). */
  mode: ColumnSortMode
  /** The number of rows in the table. */
  numRows: number
  /** The columns of the table. */
  columns: BaseColumn[]
  /** Returns the cell content at the given column and row indices. */
  getCellContent: ([col, row]: readonly [number, number]) => GridCell
}

type ColumnSortReturn = {
  /** Columns with a sort-direction indicator applied to the active column. */
  columns: BaseColumn[]
  /**
   * Toggle/apply the sort for the column at the given display index.
   *
   * @param index - The display column index.
   * @param direction - ``"asc"``/``"desc"``, or ``"auto"`` to toggle
   *   asc → desc → none. If omitted, sorting is removed.
   * @param autoReset - If ``true``, re-applying the same direction removes the
   *   sort.
   */
  sortColumn: (
    index: number,
    direction?: "asc" | "desc" | "auto",
    autoReset?: boolean
  ) => void
  /** Maps a display row index to the original row index. */
  getOriginalIndex: (index: number) => number
  /**
   * The active server-side sort state in ``"server"`` mode, or ``undefined``
   * (also ``undefined`` in ``"client"`` mode). Passed to the lazy data loader
   * so chunk requests include the sort state.
   */
  serverSortState: ServerSortState | undefined
} & Pick<DataEditorProps, "getCellContent">

const identity = (index: number): number => index

/**
 * A React hook that provides column sorting for both eager (client-side) and
 * lazy (server-side) dataframes behind one contract.
 *
 * In ``"server"`` mode the hook only manages sort state and the header
 * indicator and exposes {@link ServerSortState}; it never invokes Glide's
 * client-side sorter (which would scan the full table), and ``getOriginalIndex``
 * is the identity because the backend returns already-sorted rows.
 */
function useColumnSort({
  mode,
  numRows,
  columns,
  getCellContent,
}: UseColumnSortParams): ColumnSortReturn {
  const [sort, setSort] = useState<ActiveColumnSort>()

  const columnsById = useMemo(() => {
    const map = new Map<string, BaseColumn>()
    for (const column of columns) {
      map.set(column.id, column)
    }
    return map
  }, [columns])

  // Hidden columns are removed from `columns`. Clear an active sort when that
  // happens so the data does not silently revert to unsorted and then
  // unexpectedly reactivate the old sort if the column is shown again.
  useEffect(() => {
    setSort(currentSort =>
      currentSort !== undefined && !columnsById.has(currentSort.columnId)
        ? undefined
        : currentSort
    )
  }, [columnsById])

  const glideColumns = useMemo(
    () => columns.map(column => toGlideColumn(column)),
    [columns]
  )

  // The Glide sort config is only built in client mode. Hooks must run
  // unconditionally, so useGlideColumnSort is always called; in server mode it
  // receives no sort and zero rows, so it never scans the (potentially lazy)
  // rows or calls the cell getter across the whole table.
  const glideSort = useMemo(() => {
    if (mode !== "client" || sort === undefined) {
      return undefined
    }
    const column = columnsById.get(sort.columnId)
    if (column === undefined) {
      return undefined
    }
    return {
      column: toGlideColumn(column),
      direction: sort.direction,
      mode: column.sortMode,
    }
  }, [mode, sort, columnsById])

  const { getCellContent: getCellContentSorted, getOriginalIndex } =
    useGlideColumnSort({
      columns: glideColumns,
      getCellContent,
      rows: mode === "client" ? numRows : 0,
      sort: glideSort,
    })

  const updatedColumns = useMemo(
    () => applySortIndicator(columns, sort),
    [columns, sort]
  )

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
      // Server-side sorting keys on the backend Arrow field name; columns
      // without one (e.g. the index column, whose name is empty) cannot be
      // sorted server-side, so we ignore the request.
      if (mode === "server" && !clickedColumn.name) {
        return
      }
      setSort(getNextColumnSort(sort, clickedColumn.id, direction, autoReset))
    },
    [columns, sort, mode]
  )

  const serverSortState = useMemo<ServerSortState | undefined>(() => {
    if (mode !== "server" || sort === undefined) {
      return undefined
    }
    const column = columnsById.get(sort.columnId)
    // The backend keys the sort on the stable Arrow field name (which matches
    // the source schema), not the displayed header title. The title can be a
    // renamed label (via column_config) or, for multi-level headers, only the
    // last level, neither of which reliably identifies the backend column.
    const fieldName = column?.arrowType?.arrowField?.name
    if (!fieldName) {
      return undefined
    }
    return { column: fieldName, descending: sort.direction === "desc" }
  }, [mode, sort, columnsById])

  return {
    columns: updatedColumns,
    sortColumn,
    getOriginalIndex: mode === "client" ? getOriginalIndex : identity,
    getCellContent: mode === "client" ? getCellContentSorted : getCellContent,
    serverSortState,
  }
}

export default useColumnSort
