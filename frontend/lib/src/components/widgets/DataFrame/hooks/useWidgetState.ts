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

import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { CompactSelection, GridSelection } from "@glideapps/glide-data-grid"

import { Arrow as ArrowProto } from "@streamlit/protobuf"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import { useDebouncedCallback } from "~lib/hooks/useDebouncedCallback"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import { WidgetInfo, WidgetStateManager } from "~lib/WidgetStateManager"

import EditingState, { getColumnName } from "./EditingState"

// Debounce time for triggering a widget state update
// This prevents rapid updates to the widget state.
export const DEBOUNCE_TIME_MS = 150

// This is the state that is sent to the backend for selections
// This needs to be the same structure that is also defined
// in the Python code.
export type CellPosition = readonly [row: number, column: string]

export interface DataframeState {
  selection: {
    rows: number[]
    // We use column names instead of indices to make
    // it easier to use and unify with how data editor edits
    // are stored.
    columns: string[]
    cells: CellPosition[]
  }
}

export interface UseWidgetStateParams {
  element: ArrowProto
  widgetMgr: WidgetStateManager | undefined
  fragmentId?: string
  originalNumRows: number
  originalColumns: BaseColumn[]
  /**
   * Hash of the underlying data. Used to detect when data content changes
   * (e.g., cell values modified externally) to trigger state reconciliation.
   * When used with a stable widget ID (user-provided key), this allows
   * detecting value changes while preserving valid editing state.
   */
  dataHash: string
}

export interface UseWidgetStateReturn {
  // The editing state reference
  editingState: MutableRefObject<EditingState>
  // The current number of rows (including additions/deletions)
  numRows: number
  // Callback to reset the editing state
  resetEditingState: () => void
  // Callback to update numRows from editing state
  updateNumRows: () => void
  // Debounced callback to sync editing state with widget manager
  syncEditState: () => void
  // Creates a sync selection state callback for the given columns and getOriginalIndex
  // This needs to be called after useColumnSort since it needs the sorted columns and getOriginalIndex
  createSyncSelectionState: (
    columns: BaseColumn[],
    getOriginalIndex: (row: number) => number
  ) => (newSelection: GridSelection, syncCellSelections: boolean) => void
  // Callback for form clear handling
  onFormCleared: () => void
  // Loads initial selection state from widget manager
  // Returns the initial selection if found, undefined otherwise
  loadInitialSelectionState: (params: {
    columns: BaseColumn[]
    isRowSelectionActivated: boolean
    isColumnSelectionActivated: boolean
    isCellSelectionActivated: boolean
    isMultiCellSelectionActivated: boolean
  }) => GridSelection | undefined
}

/**
 * Custom hook that handles widget state management for the DataFrame component.
 * This includes:
 * - Managing the EditingState (edits, added rows, deleted rows)
 * - Syncing editing state with the widget manager
 * - Syncing selection state with the widget manager
 * - Loading initial state from the widget manager
 * - Handling form clear events
 *
 * @param params - The parameters for the hook
 * @returns The widget state management utilities
 */
function useWidgetState({
  element,
  widgetMgr,
  fragmentId,
  originalNumRows,
  originalColumns,
  dataHash,
}: UseWidgetStateParams): UseWidgetStateReturn {
  const { READ_ONLY } = ArrowProto.EditingMode

  // EditingState management
  const editingState = useRef<EditingState>(new EditingState(originalNumRows))
  const [numRows, setNumRows] = useState(editingState.current.getNumRows())

  // Track if we need to sync the editing state after reconciliation
  const needsSyncAfterReconcile = useRef(false)

  // Reconcile or reset editing state when originalNumRows or dataHash changes.
  // Using useExecuteWhenChanged instead of useEffect to follow React best practices
  // for adjusting state when props change (avoids extra render cycle).
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  //
  // KEY INSIGHT: This hook only runs on UPDATES (not first render). If we're here,
  // it means the component persisted across reruns (user provided a key) and
  // either the row count or data content changed.
  //
  // Phase 2 Reconciliation Strategy:
  //   - If row count changed due to user actions (deletions/additions via UI),
  //     we can RECONCILE: preserve valid edits, adjust indices for deleted rows.
  //   - If row count changed externally (or we can't verify), RESET to be safe.
  //   - If only data values changed (same row count), RESET since we don't track
  //     which specific values changed.
  //
  // How we detect user-initiated row changes:
  //   expected_rows = original_rows - deletedRows + addedRows
  //   If new_rows == expected_rows → user-initiated → reconcile
  //   Else → external change → reset
  useExecuteWhenChanged(() => {
    const currentState = editingState.current

    // Check if row count change was user-initiated (via data_editor UI)
    if (currentState.canReconcileRowChanges(originalNumRows)) {
      // User-initiated row change: reconcile to preserve valid edits
      editingState.current =
        currentState.reconcileAfterUserChanges(originalNumRows)
    } else {
      // External change or data values changed: reset to fresh state
      editingState.current = new EditingState(originalNumRows)
    }

    setNumRows(editingState.current.getNumRows())

    // Mark that we need to sync the reconciled/reset state to the backend
    // This prevents old deletedRows/addedRows from being re-applied
    needsSyncAfterReconcile.current = true
  }, [originalNumRows, dataHash])

  // Sync the reconciled/reset state to the backend after render completes
  // This is critical to prevent old row deletions/additions from being re-applied
  useEffect(() => {
    if (needsSyncAfterReconcile.current && widgetMgr) {
      needsSyncAfterReconcile.current = false

      const currentEditingState = editingState.current.toJson(originalColumns)
      widgetMgr.setStringValue(
        {
          id: element.id,
          formId: element.formId,
        } as WidgetInfo,
        currentEditingState,
        {
          fromUi: true,
        },
        fragmentId
      )
    }
  })

  /**
   * Resets the editing state to a fresh state
   */
  const resetEditingState = useCallback(() => {
    editingState.current = new EditingState(originalNumRows)
    setNumRows(editingState.current.getNumRows())
  }, [originalNumRows])

  /**
   * Updates numRows from the editing state.
   * This is required to keep the component state in sync with the editing state.
   * Uses functional update form to avoid stale closure issues while keeping the callback stable.
   */
  const updateNumRows = useCallback(() => {
    setNumRows(currentNumRows => {
      const newNumRows = editingState.current.getNumRows()
      return currentNumRows !== newNumRows ? newNumRows : currentNumRows
    })
  }, [])

  /**
   * Load initial editing state from widget manager on first render.
   * This is required in the case that other elements are inserted before this widget.
   * In this case, it can happen that the dataframe component is unmounted and thereby loses
   * its state. Once the same element is rendered again, we try to reconstruct the state
   * from the widget manager values.
   *
   * IMPORTANT: We must validate that the loaded state is still valid for the current data.
   * If the user saved the edited dataframe to session_state, the deletedRows/addedRows
   * have already been applied to the source data. Re-applying them would be incorrect.
   */
  useEffect(
    () => {
      if (element.editingMode === READ_ONLY || !widgetMgr) {
        // We don't need to load the initial widget state
        // for read-only dataframes.
        return
      }

      const initialWidgetValue = widgetMgr.getStringValue({
        id: element.id,
        formId: element.formId,
      } as WidgetInfo)

      if (!initialWidgetValue) {
        // No initial widget value was saved in the widget manager.
        // No need to reconstruct something.
        return
      }

      // Parse the saved state to check if it's valid for the current data
      let savedState: {
        edited_rows?: Record<number, unknown>
        added_rows?: unknown[]
        deleted_rows?: number[]
      }
      try {
        savedState = JSON.parse(initialWidgetValue)
      } catch {
        // Invalid JSON, don't restore
        return
      }

      const deletedCount = savedState.deleted_rows?.length ?? 0
      const addedCount = savedState.added_rows?.length ?? 0

      // If there are row additions or deletions in the saved state, we need to
      // verify they haven't already been applied to the source data.
      // The saved state was created when there were (originalNumRows + deleted - added) rows.
      // If the current originalNumRows doesn't match this, the edits were likely applied.
      if (deletedCount > 0 || addedCount > 0) {
        // The expected source rows when this state was created:
        // If we deleted 2 rows and added 1, the original source had:
        // originalNumRows + deletedCount - addedCount rows
        // But we can't know the original - we only have current.
        //
        // SAFER APPROACH: If there are deletions or additions, only restore
        // the state if the row count BEFORE applying edits matches current.
        // currentRows should equal originalNumRows (before edits).
        // The editing state's "visible" row count = original - deleted + added
        // So: original = visible + deleted - added
        //
        // If the user saved to session_state, the current data has the
        // MODIFIED row count. The state expects the ORIGINAL row count.
        // So we check: does the state's expected original match current?
        //
        // Actually, the simplest check: if there are pending row changes,
        // don't restore them. Cell edits are safer to restore.
        // This prevents the double-deletion issue.

        // Only restore cell edits, not row additions/deletions
        const cellEditsOnly = {
          edited_rows: savedState.edited_rows ?? {},
          added_rows: [],
          deleted_rows: [],
        }

        // Check if any cell edits reference valid rows
        const editedRowKeys = Object.keys(cellEditsOnly.edited_rows)
        const validEdits: Record<number, unknown> = {}
        for (const key of editedRowKeys) {
          const rowIdx = parseInt(key, 10)
          if (rowIdx < originalNumRows) {
            validEdits[rowIdx] = cellEditsOnly.edited_rows[rowIdx]
          }
        }

        if (Object.keys(validEdits).length > 0) {
          editingState.current.fromJson(
            JSON.stringify({
              edited_rows: validEdits,
              added_rows: [],
              deleted_rows: [],
            }),
            originalColumns
          )
          setNumRows(editingState.current.getNumRows())
        }
      } else {
        // No row changes in saved state, safe to restore everything
        // (just cell edits)
        editingState.current.fromJson(initialWidgetValue, originalColumns)
        setNumRows(editingState.current.getNumRows())
      }
    },
    // We only want to run this effect once during the initial component load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  /**
   * Inner function to sync editing state with widget manager.
   * This is wrapped with debounce below.
   */
  const innerSyncEditState = useCallback(() => {
    if (!widgetMgr) {
      return
    }

    const currentEditingState = editingState.current.toJson(originalColumns)
    let currentWidgetState = widgetMgr.getStringValue({
      id: element.id,
      formId: element.formId,
    } as WidgetInfo)

    if (currentWidgetState === undefined) {
      // Create an empty widget state
      currentWidgetState = new EditingState(0).toJson([])
    }

    // Only update if there is actually a difference between editing and widget state
    if (currentEditingState !== currentWidgetState) {
      widgetMgr.setStringValue(
        {
          id: element.id,
          formId: element.formId,
        } as WidgetInfo,
        currentEditingState,
        {
          fromUi: true,
        },
        fragmentId
      )
    }
  }, [originalColumns, element.id, element.formId, widgetMgr, fragmentId])

  // Debounced version of syncEditState to prevent rapid updates
  const { debouncedCallback: syncEditState } = useDebouncedCallback(
    innerSyncEditState,
    DEBOUNCE_TIME_MS
  )

  /**
   * Creates a function to sync selection state with the widget manager.
   * This needs to be called after useColumnSort to get the sorted columns and getOriginalIndex.
   *
   * @param columns - The sorted columns from useColumnSort
   * @param getOriginalIndex - Function to get the original row index (from useColumnSort)
   * @returns A function that syncs selection state with the widget manager
   */
  const createSyncSelectionState = useCallback(
    (
      columns: BaseColumn[],
      getOriginalIndex: (row: number) => number
    ): ((
      newSelection: GridSelection,
      syncCellSelections: boolean
    ) => void) => {
      return (newSelection: GridSelection, syncCellSelections: boolean) => {
        if (!widgetMgr) {
          return
        }

        const selectionState: DataframeState = {
          selection: {
            rows: [] as number[],
            columns: [] as string[],
            cells: [] as CellPosition[],
          },
        }

        selectionState.selection.rows = newSelection.rows
          .toArray()
          .map(row => getOriginalIndex(row))
        selectionState.selection.columns = newSelection.columns
          .toArray()
          .map(columnIdx => getColumnName(columns[columnIdx]))

        // Parse cell selections into our widget state structure:
        if (syncCellSelections && newSelection.current) {
          const { cell, range } = newSelection.current
          if (range) {
            // Multi-cell selection (rectangular structure)
            for (let r = range.y; r < range.y + range.height; r++) {
              for (let c = range.x; c < range.x + range.width; c++) {
                if (!columns[c].isIndex) {
                  selectionState.selection.cells.push([
                    getOriginalIndex(r),
                    getColumnName(columns[c]),
                  ])
                }
              }
            }
          } else if (cell) {
            // Single-cell selection
            const [col, row] = cell
            if (!columns[col].isIndex) {
              selectionState.selection.cells.push([
                getOriginalIndex(row),
                getColumnName(columns[col]),
              ])
            }
          }
        }

        const newWidgetState = JSON.stringify(selectionState)
        const currentWidgetState = widgetMgr.getStringValue({
          id: element.id,
          formId: element.formId,
        } as WidgetInfo)

        // Only update if there is actually a difference to the previous selection state
        if (
          currentWidgetState === undefined ||
          currentWidgetState !== newWidgetState
        ) {
          widgetMgr.setStringValue(
            {
              id: element.id,
              formId: element.formId,
            } as WidgetInfo,
            newWidgetState,
            {
              fromUi: true,
            },
            fragmentId
          )
        }
      }
    },
    [element.id, element.formId, widgetMgr, fragmentId]
  )

  /**
   * Loads initial selection state from the widget manager.
   * This should be called during component initialization to restore
   * any previously saved selection state.
   *
   * @param params - Parameters containing columns and selection mode flags
   * @returns The initial GridSelection if found, undefined otherwise
   */
  const loadInitialSelectionState = useCallback(
    ({
      columns,
      isRowSelectionActivated,
      isColumnSelectionActivated,
      isCellSelectionActivated,
      isMultiCellSelectionActivated,
    }: {
      columns: BaseColumn[]
      isRowSelectionActivated: boolean
      isColumnSelectionActivated: boolean
      isCellSelectionActivated: boolean
      isMultiCellSelectionActivated: boolean
    }): GridSelection | undefined => {
      if (
        (!isRowSelectionActivated &&
          !isColumnSelectionActivated &&
          !isCellSelectionActivated) ||
        !widgetMgr
      ) {
        return undefined
      }

      const initialWidgetValue = widgetMgr.getStringValue({
        id: element.id,
        formId: element.formId,
      } as WidgetInfo)

      if (!initialWidgetValue) {
        return undefined
      }

      const columnNames: string[] = columns.map(column =>
        getColumnName(column)
      )

      const selectionState: DataframeState = JSON.parse(initialWidgetValue)

      let rowSelection = CompactSelection.empty()
      let columnSelection = CompactSelection.empty()
      let cellSelection: [number, number] | undefined = undefined

      selectionState.selection?.rows?.forEach(row => {
        rowSelection = rowSelection.add(row)
      })

      selectionState.selection?.columns?.forEach(column => {
        columnSelection = columnSelection.add(columnNames.indexOf(column))
      })

      // Reconstruct for single cell selection:
      if (isCellSelectionActivated && !isMultiCellSelectionActivated) {
        // If cell selection is activated but multi-cell selection is not,
        // we need to set the current cell selection to the first cell in the selection.
        const [rowIdx, columnName] = selectionState.selection?.cells?.[0] ?? []
        if (rowIdx !== undefined && columnName !== undefined) {
          const columnIdx = columnNames.indexOf(columnName)
          cellSelection = [columnIdx, rowIdx]
        }
      }

      if (
        rowSelection.length > 0 ||
        columnSelection.length > 0 ||
        cellSelection !== undefined
      ) {
        // Return the initial selection state
        return {
          rows: rowSelection,
          columns: columnSelection,
          current: cellSelection
            ? {
                cell: cellSelection,
                range: {
                  x: cellSelection[0],
                  y: cellSelection[1],
                  // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
                  width: 1,
                  // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
                  height: 1,
                },
                rangeStack: [],
              }
            : undefined,
        }
      }

      return undefined
    },
    [widgetMgr, element.id, element.formId]
  )

  /**
   * Callback for when the form is cleared.
   * Resets the editing state.
   */
  const onFormCleared = useCallback(() => {
    resetEditingState()
  }, [resetEditingState])

  return {
    editingState,
    numRows,
    resetEditingState,
    updateNumRows,
    syncEditState,
    createSyncSelectionState,
    onFormCleared,
    loadInitialSelectionState,
  }
}

export default useWidgetState
