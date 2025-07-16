/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { Dispatch, SetStateAction, useCallback, useMemo } from "react"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"

import { updateColumnConfigTypeProps } from "./columnConfigUtils"

type ColumnPinningReturn = {
  // The number of columns to freeze.
  freezeColumns: number
  // Pin a column to the left side of the table.
  pinColumn: (columnId: string) => void
  // Unpin a column from the left side of the table.
  unpinColumn: (columnId: string) => void
}

/**
 * A React hook that adds the ability to pin/freeze columns to the left side of the table.
 *
 * @param columns - The columns of the table
 * @param isEmptyTable - Whether the table is empty (no rows)
 * @param containerWidth - The width of the parent container
 * @param minColumnWidth - The minimum width allowed for a column
 * @param clearSelection - A callback to clear current selections in the table
 * @param setColumnConfigMapping - A callback to set the column config mapping state
 *
 * @returns An object containing the following properties:
 * - `pinColumn`: A callback to pin a column
 * - `unpinColumn`: A callback to unpin a column
 * - `freezeColumns`: The number of columns to freeze
 */
function useColumnPinning(
  columns: BaseColumn[],
  isEmptyTable: boolean,
  containerWidth: number,
  minColumnWidth: number,
  clearSelection: (keepRows?: boolean, keepColumns?: boolean) => void,
  setColumnConfigMapping: Dispatch<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    SetStateAction<Map<string, any>>
  >
): ColumnPinningReturn {
  // This is a simple heuristic to prevent the pinned columns
  // from taking up too much space and prevent horizontal scrolling.
  // Since its not easy to determine the current width of auto-sized columns,
  // we just use 2x of the min column width as a fallback.
  // The combined width of all pinned columns should not exceed 60%
  // of the container width.
  const isPinnedColumnsWidthTooLarge = useMemo(() => {
    return (
      columns
        .filter((col: BaseColumn) => col.isPinned)
        .reduce((acc, col) => acc + (col.width ?? minColumnWidth * 2), 0) >
      containerWidth * 0.6
    )
  }, [columns, containerWidth, minColumnWidth])

  // All pinned columns are expected to be moved to the beginning
  // in useColumnLoader. So we can just count all pinned columns here.
  const freezeColumns =
    isEmptyTable || isPinnedColumnsWidthTooLarge
      ? 0
      : columns.filter((col: BaseColumn) => col.isPinned).length

  const unpinColumn = useCallback(
    (columnId: string) => {
      setColumnConfigMapping(prevColumnConfigMapping => {
        return updateColumnConfigTypeProps({
          columnId,
          columnConfigMapping: prevColumnConfigMapping,
          updatedProps: {
            pinned: false,
          },
        })
      })
      clearSelection(true, false)
    },
    [clearSelection, setColumnConfigMapping]
  )

  const pinColumn = useCallback(
    (columnId: string) => {
      setColumnConfigMapping(prevColumnConfigMapping => {
        return updateColumnConfigTypeProps({
          columnId,
          columnConfigMapping: prevColumnConfigMapping,
          updatedProps: {
            pinned: true,
          },
        })
      })
      clearSelection(true, false)
    },
    [clearSelection, setColumnConfigMapping]
  )

  return {
    pinColumn,
    unpinColumn,
    freezeColumns,
  }
}

export default useColumnPinning
