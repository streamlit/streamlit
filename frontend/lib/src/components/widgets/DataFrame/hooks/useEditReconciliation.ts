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

import { type MutableRefObject, useCallback, useMemo } from "react"

import { getCellFromArrow } from "~lib/components/widgets/DataFrame/arrowUtils"
import {
  BaseColumn,
  valuesEqual,
} from "~lib/components/widgets/DataFrame/columns"
import { Quiver } from "~lib/dataframes/Quiver"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"

import EditingState from "./EditingState"

interface UseEditReconciliationParams {
  data: Quiver
  allColumns: BaseColumn[]
  editingState: MutableRefObject<EditingState>
  isEditingEnabled: boolean
  syncEditState: () => void
}

interface UseEditReconciliationReturn {
  getSourceCellValue: (column: BaseColumn, originalRow: number) => unknown
}

function useEditReconciliation({
  data,
  allColumns,
  editingState,
  isEditingEnabled,
  syncEditState,
}: UseEditReconciliationParams): UseEditReconciliationReturn {
  const columnsByIndex = useMemo(() => {
    return new Map(allColumns.map(column => [column.indexNumber, column]))
  }, [allColumns])

  const getSourceCellValue = useCallback(
    (column: BaseColumn, originalRow: number): unknown => {
      if (
        originalRow < 0 ||
        originalRow >= data.dimensions.numDataRows ||
        column.indexNumber >= data.dimensions.numColumns
      ) {
        return undefined
      }

      const arrowCell = data.getCell(originalRow, column.indexNumber)
      const sourceCell = getCellFromArrow(column, arrowCell, undefined)
      return column.getCellValue(sourceCell)
    },
    [data]
  )

  useExecuteWhenChanged(() => {
    if (!isEditingEnabled) {
      return
    }

    let hasClearedCells = false

    editingState.current.forEachEditedCell(
      (originalCol, originalRow, cell) => {
        const column = columnsByIndex.get(originalCol)

        if (
          !column ||
          originalRow < 0 ||
          originalRow >= data.dimensions.numDataRows
        ) {
          return
        }

        const sourceValue = getSourceCellValue(column, originalRow)
        const editedValue = column.getCellValue(cell)

        if (valuesEqual(sourceValue, editedValue, column)) {
          editingState.current.clearCell(originalCol, originalRow)
          hasClearedCells = true
        }
      }
    )

    // No explicit repaint is needed for the cleared cells: this callback runs
    // during render (via useExecuteWhenChanged), so the edits are cleared
    // before the grid repaints, and the data change that triggered the
    // reconciliation gives the grid a fresh `getCellContent` that reflects the
    // reconciled source values.
    if (hasClearedCells) {
      syncEditState()
    }
    // `isEditingEnabled` is watched so that reconciliation also runs when
    // editing is re-enabled after having been disabled during a data refresh
    // (which would otherwise skip reconciliation and leave stale edits).
  }, [data, isEditingEnabled])

  return {
    getSourceCellValue,
  }
}

export default useEditReconciliation
