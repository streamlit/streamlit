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

import { DataEditorProps, GridCell } from "@glideapps/glide-data-grid"

import { getCellFromArrow } from "~lib/components/widgets/DataFrame/arrowUtils"
import {
  BaseColumn,
  getErrorCell,
} from "~lib/components/widgets/DataFrame/columns"
import EditingState from "~lib/components/widgets/DataFrame/EditingState"
import { getStyledCell } from "~lib/dataframes/pandasStylerUtils"
import { Quiver } from "~lib/dataframes/Quiver"
import { notNullOrUndefined } from "~lib/util/utils"

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
  const getCellContent = useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      if (col > columns.length - 1) {
        return getErrorCell(
          "Column index out of bounds",
          "This error should never happen. Please report this bug."
        )
      }

      if (row > numRows - 1) {
        return getErrorCell(
          "Row index out of bounds",
          "This error should never happen. Please report this bug."
        )
      }

      try {
        const column = columns[col]

        const originalCol = column.indexNumber
        const originalRow = editingState.current.getOriginalRowIndex(row)
        const isAddedRow = editingState.current.isAddedRow(originalRow)
        // Use editing state if editable or if it is an appended row
        if (column.isEditable || isAddedRow) {
          // TODO(lukasmasuch): Investigate why this might throw an error when
          // the input data of a read-only dataframe changes its dimensions.
          // https://github.com/streamlit/streamlit/issues/10937
          const editedCell = editingState.current.getCell(
            originalCol,
            originalRow
          )
          if (notNullOrUndefined(editedCell)) {
            // Create a new representation of the edited cell to apply
            // changes that might have been applied to the column (e.g. change of format from UI).
            // TODO(lukasmasuch): We should refactor this at some point to avoid storing
            // cells in the editing state. It would be enough to store the value and the
            // last updated timestamp.
            return {
              ...column.getCell(column.getCellValue(editedCell), false),
              // Apply the last updated timestamp stored in the edited cell:
              lastUpdated: editedCell.lastUpdated,
            }
          } else if (isAddedRow) {
            // This is not expected to happen. All cells to added rows should
            // be defined. If not, we return a specific error cell.
            return getErrorCell(
              "Error during cell creation",
              "This error should never happen. Please report this bug. " +
                `No cell found for an added row: col=${originalCol}; row=${originalRow}`
            )
          }
        }

        // We skip all header rows to get to to the actual data rows.
        // in th Arrow data.
        const arrowCell = data.getCell(originalRow, originalCol)
        const styledCell = getStyledCell(data, originalRow, originalCol)

        return getCellFromArrow(
          column,
          arrowCell,
          styledCell,
          data.styler?.cssStyles
        )
      } catch (error) {
        return getErrorCell(
          "Error during cell creation",
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `This error should never happen. Please report this bug. \nError: ${error}`
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
