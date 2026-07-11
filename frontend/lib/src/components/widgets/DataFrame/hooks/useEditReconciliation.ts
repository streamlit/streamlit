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

import { type MutableRefObject, useCallback, useMemo, useRef } from "react"

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

/**
 * Reconciles pending edits against the current source data.
 *
 * The data editor preserves a user's pending edits across reruns even when the
 * underlying data value changes (see `_compute_data_editor_signature` in
 * `data_editor.py`). This means an edit can become redundant if the new source
 * data already matches what the user typed. When that happens, keeping the edit
 * would make the cell look "edited" (e.g. it stays in `edited_rows`) even though
 * its value is identical to the source.
 *
 * Whenever the `data` changes (or editing is re-enabled after a refresh), this
 * hook walks every edited cell and compares its value against the corresponding
 * source cell using the column's `valuesEqual` comparator. Cells whose edit now
 * equals the source value are cleared, so only genuine, still-diverging edits
 * remain in the editing state.
 *
 * The reconciliation runs during render (via `useExecuteWhenChanged`) so edits
 * are cleared before the grid repaints; the data change that triggered the
 * reconciliation already provides a fresh `getCellContent`, so no explicit
 * repaint is required. `syncEditState` is only called when at least one cell was
 * cleared, to push the reconciled editing state to the widget value.
 *
 * @param data - The current source data (Quiver).
 * @param allColumns - All columns, used to map edited cells back to their column.
 * @param editingState - Ref to the mutable editing state holding pending edits.
 * @param isEditingEnabled - Whether editing is currently enabled; reconciliation
 *   is skipped while disabled and re-runs once it is re-enabled.
 * @param syncEditState - Callback to propagate the editing state to the widget
 *   value after edits are cleared.
 * @returns `getSourceCellValue`, which reads the raw source value for a given
 *   column and original (unsorted) row index.
 */
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

  const reconcileEdits = (): void => {
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

    // No explicit repaint is needed for the cleared cells: reconciliation runs
    // during render, so the edits are cleared before the grid repaints.
    if (hasClearedCells) {
      syncEditState()
    }
    // `isEditingEnabled` is watched so that reconciliation also runs when
    // editing is re-enabled after having been disabled during a data refresh
    // (which would otherwise skip reconciliation and leave stale edits).
  }

  const hasReconciledInitialDataRef = useRef(false)
  useExecuteWhenChanged(reconcileEdits, [data, isEditingEnabled])

  if (!hasReconciledInitialDataRef.current) {
    hasReconciledInitialDataRef.current = true
    reconcileEdits()
  }

  return {
    getSourceCellValue,
  }
}

export default useEditReconciliation
