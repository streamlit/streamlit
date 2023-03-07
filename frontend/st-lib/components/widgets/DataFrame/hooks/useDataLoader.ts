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

import { GridCell, DataEditorProps } from "@glideapps/glide-data-grid"

import { Quiver } from "src/lib/Quiver"
import { logError } from "src/lib/log"

import { getCellFromArrow } from "src/components/widgets/DataFrame/arrowUtils"
import EditingState from "src/components/widgets/DataFrame/EditingState"
import {
  BaseColumn,
  getErrorCell,
} from "src/components/widgets/DataFrame/columns"

type DataLoaderReturn = Pick<DataEditorProps, "getCellContent">

/**
 * Custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 *
 * @param data - The Arrow data extracted from the proto message
 * @param numRows - The number of rows of the current state (includes row additions/deletions)
 * @param editingState - The editing state of the data editor
 *
 * @returns the columns and the cell content getter compatible with glide-data-grid.
 */
function useDataLoader(
  data: Quiver,
  columns: BaseColumn[],
  numRows: number,
  editingState: React.MutableRefObject<EditingState>
): DataLoaderReturn {
  const getCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      if (col > columns.length - 1) {
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
      const column = columns[col]

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
        // Arrow has the header in first row
        const arrowCell = data.getCell(originalRow + 1, originalCol)
        return getCellFromArrow(column, arrowCell, data.cssStyles)
      } catch (error) {
        logError(error)
        return getErrorCell(
          "Error during cell creation.",
          `This should never happen. Please report this bug. \nError: ${error}`
        )
      }
    },
    [columns, numRows, data, editingState]
  )

  return {
    getCellContent,
  }
}

export default useDataLoader
