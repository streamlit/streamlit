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

import React, { useCallback } from "react"

import { DataEditorProps } from "@glideapps/glide-data-grid"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"

type ColumnReorderingReturn = Pick<DataEditorProps, "onColumnMoved">

/**
 * A React hook that adds the ability to reorder columns via drag and drop in the UI.
 *
 * @param columns - The columns of the table.
 * @param freezeColumns - The number of columns to freeze
 * @param pinColumn - A callback to pin a column
 * @param unpinColumn - A callback to unpin a column
 * @param setColumnOrder - A callback to set the column order state
 *
 * @returns An object containing the following properties:
 * - `onColumnMoved`: A glide-data-grid compatible callback to handle column movement.
 */
function useColumnReordering(
  columns: BaseColumn[],
  freezeColumns: number,
  pinColumn: (columnId: string) => void,
  unpinColumn: (columnId: string) => void,
  setColumnOrder: React.Dispatch<React.SetStateAction<string[]>>
): ColumnReorderingReturn {
  const onColumnMoved = useCallback(
    (startIndex: number, endIndex: number): void => {
      // Create a shallow copy of the original columns
      const newColumns = [...columns]

      // Remove the column from its original position
      const [movedColumn] = newColumns.splice(startIndex, 1)

      // Insert the column into its new position
      newColumns.splice(endIndex, 0, movedColumn)

      // Pin or unpin the column if necessary:
      if (endIndex < freezeColumns && !movedColumn.isPinned) {
        pinColumn(movedColumn.id)
      } else if (endIndex >= freezeColumns && movedColumn.isPinned) {
        unpinColumn(movedColumn.id)
      }

      // Update the column order with the new sequence of column IDs
      setColumnOrder(newColumns.map(column => column.id))
    },
    [columns, freezeColumns, pinColumn, unpinColumn, setColumnOrder]
  )

  return {
    onColumnMoved,
  }
}

export default useColumnReordering
