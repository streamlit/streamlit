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

import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { CompactSelection, GridSelection } from "@glideapps/glide-data-grid"

import { Dataframe as DataframeProto } from "@streamlit/protobuf"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"
import { useDebouncedCallback } from "~lib/hooks/useDebouncedCallback"
import { useExecuteWhenChanged } from "~lib/hooks/useExecuteWhenChanged"
import { WidgetInfo, WidgetStateManager } from "~lib/WidgetStateManager"

import EditingState, { getColumnName } from "./EditingState"

// Debounce time for triggering a widget state update
// This prevents rapid updates to the widget state.
export const DEBOUNCE_TIME_MS = 150

/**
 * Validate that a parsed JSON value has the minimum shape
 * required to represent dataframe selections.
 */
function isSelectionState(
  value: unknown
): value is Pick<DataframeState, "selection"> {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const selection = (value as { selection?: unknown }).selection
  return typeof selection === "object" && selection !== null
}

/**
 * Parses a JSON selection state string into a GridSelection object.
 * Shared by loadInitialSelectionState and getProgrammaticSelectionState.
 *
 * When returnEmptySelection is true, returns an empty GridSelection instead
 * of undefined when no items are selected (used for programmatic clearing).
 * originalToDisplayIndex maps backend row indices to display indices when
 * the grid is sorted.
 */
function parseSelectionStateToGridSelection(
  selectionStateJson: string,
  columns: BaseColumn[],
  isCellSelectionActivated: boolean,
  isMultiCellSelectionActivated: boolean,
  returnEmptySelection: boolean,
  originalToDisplayIndex?: (originalIdx: number) => number | undefined
): GridSelection | undefined {
  let selectionState: unknown
  try {
    selectionState = JSON.parse(selectionStateJson)
  } catch {
    return undefined
  }

  if (!isSelectionState(selectionState)) {
    return undefined
  }

  const columnNames = columns.map(column => getColumnName(column))

  let rowSelection = CompactSelection.empty()
  let columnSelection = CompactSelection.empty()
  let cellSelection: [number, number] | undefined = undefined

  selectionState.selection?.rows?.forEach(row => {
    const displayRow = originalToDisplayIndex
      ? originalToDisplayIndex(row)
      : row
    if (displayRow !== undefined) {
      rowSelection = rowSelection.add(displayRow)
    }
  })

  selectionState.selection?.columns?.forEach(column => {
    const idx = columnNames.indexOf(column)
    if (idx >= 0) {
      columnSelection = columnSelection.add(idx)
    }
  })

  // Reconstruct cell selection for single-cell mode only.
  // Multi-cell ranges cannot be properly reconstructed from individual cell positions
  // because they require rectangular range information.
  if (isCellSelectionActivated && !isMultiCellSelectionActivated) {
    const [rowIdx, columnName] = selectionState.selection?.cells?.[0] ?? []
    if (rowIdx !== undefined && columnName !== undefined) {
      const displayRow = originalToDisplayIndex
        ? originalToDisplayIndex(rowIdx)
        : rowIdx
      const columnIdx = columnNames.indexOf(columnName)
      if (displayRow !== undefined && columnIdx >= 0) {
        cellSelection = [columnIdx, displayRow]
      }
    }
  }

  if (
    returnEmptySelection ||
    rowSelection.length > 0 ||
    columnSelection.length > 0 ||
    cellSelection !== undefined
  ) {
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
}

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
  element: DataframeProto
  widgetMgr: WidgetStateManager | undefined
  fragmentId?: string
  originalNumRows: number
  originalColumns: BaseColumn[]
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
  // Gets the programmatic selection state from a selection state JSON string.
  // Returns the GridSelection and syncs to widget manager if present.
  getProgrammaticSelectionState: (params: {
    selectionState: string
    columns: BaseColumn[]
    isRowSelectionActivated: boolean
    isColumnSelectionActivated: boolean
    isCellSelectionActivated: boolean
    isMultiCellSelectionActivated: boolean
    getOriginalIndex: (displayIdx: number) => number
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
}: UseWidgetStateParams): UseWidgetStateReturn {
  const { READ_ONLY } = DataframeProto.EditingMode

  // EditingState management
  const editingStateRef = useRef<EditingState>(
    new EditingState(originalNumRows)
  )
  const [numRows, setNumRows] = useState(editingStateRef.current.getNumRows())

  // Reset editing state when originalNumRows changes.
  // Using useExecuteWhenChanged instead of useEffect to follow React best practices
  // for adjusting state when props change (avoids extra render cycle).
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  useExecuteWhenChanged(() => {
    editingStateRef.current = new EditingState(originalNumRows)
    setNumRows(editingStateRef.current.getNumRows())
  }, [originalNumRows])

  /**
   * Resets the editing state to a fresh state
   */
  const resetEditingState = useCallback(() => {
    editingStateRef.current = new EditingState(originalNumRows)
    setNumRows(editingStateRef.current.getNumRows())
  }, [originalNumRows])

  /**
   * Updates numRows from the editing state.
   * This is required to keep the component state in sync with the editing state.
   * Uses functional update form to avoid stale closure issues while keeping the callback stable.
   */
  const updateNumRows = useCallback(() => {
    setNumRows(currentNumRows => {
      const newNumRows = editingStateRef.current.getNumRows()
      return currentNumRows !== newNumRows ? newNumRows : currentNumRows
    })
  }, [])

  /**
   * Load initial editing state from widget manager on first render.
   * This is required in the case that other elements are inserted before this widget.
   * In this case, it can happen that the dataframe component is unmounted and thereby loses
   * its state. Once the same element is rendered again, we try to reconstruct the state
   * from the widget manager values.
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

      editingStateRef.current.fromJson(initialWidgetValue, originalColumns)
      setNumRows(editingStateRef.current.getNumRows())
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

    const currentEditingState = editingStateRef.current.toJson(originalColumns)
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
   * Loads initial selection state from the widget manager during component
   * initialization. Returns the restored GridSelection, or undefined.
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
      // Skip if programmatic selection is set; the dedicated effect handles it
      if (element.selectionState) {
        return undefined
      }

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

      if (initialWidgetValue) {
        return parseSelectionStateToGridSelection(
          initialWidgetValue,
          columns,
          isCellSelectionActivated,
          isMultiCellSelectionActivated,
          false // Don't return empty selection for initial load
        )
      }

      if (!element.selectionDefault) {
        return undefined
      }

      const defaultSelection = parseSelectionStateToGridSelection(
        element.selectionDefault,
        columns,
        isCellSelectionActivated,
        isMultiCellSelectionActivated,
        true // Return empty selection to allow explicit defaults
      )

      if (defaultSelection !== undefined) {
        widgetMgr.setStringValue(
          {
            id: element.id,
            formId: element.formId,
          } as WidgetInfo,
          element.selectionDefault,
          {
            fromUi: false,
          },
          fragmentId
        )
      }

      return defaultSelection
    },
    [
      widgetMgr,
      element.id,
      element.formId,
      element.selectionState,
      element.selectionDefault,
      fragmentId,
    ]
  )

  /**
   * Callback for when the form is cleared.
   * Resets the editing state.
   */
  const onFormCleared = useCallback(() => {
    resetEditingState()
  }, [resetEditingState])

  /**
   * Parses element.selectionState into a GridSelection and syncs it to the
   * widget manager. Used when the user sets selection via st.session_state.
   */
  const getProgrammaticSelectionState = useCallback(
    ({
      selectionState,
      columns,
      isRowSelectionActivated,
      isColumnSelectionActivated,
      isCellSelectionActivated,
      isMultiCellSelectionActivated,
      getOriginalIndex,
    }: {
      selectionState: string
      columns: BaseColumn[]
      isRowSelectionActivated: boolean
      isColumnSelectionActivated: boolean
      isCellSelectionActivated: boolean
      isMultiCellSelectionActivated: boolean
      getOriginalIndex: (displayIdx: number) => number
    }): GridSelection | undefined => {
      if (!widgetMgr) {
        return undefined
      }

      if (
        !isRowSelectionActivated &&
        !isColumnSelectionActivated &&
        !isCellSelectionActivated
      ) {
        return undefined
      }

      // Build reverse mapping: original → display row index (they differ
      // when the grid is sorted).
      const originalToDisplay = new Map<number, number>()
      for (let i = 0; i < originalNumRows; i++) {
        originalToDisplay.set(getOriginalIndex(i), i)
      }
      const originalToDisplayIndex = (
        originalIdx: number
      ): number | undefined => originalToDisplay.get(originalIdx)

      const selection = parseSelectionStateToGridSelection(
        selectionState,
        columns,
        isCellSelectionActivated,
        isMultiCellSelectionActivated,
        true, // Return empty selection to allow programmatic clearing
        originalToDisplayIndex
      )

      // Only sync to widget manager if the selection state could be parsed.
      // This avoids overwriting a previously valid persisted selection with
      // malformed JSON.
      if (selection !== undefined) {
        widgetMgr.setStringValue(
          {
            id: element.id,
            formId: element.formId,
          } as WidgetInfo,
          selectionState,
          {
            fromUi: false,
          },
          fragmentId
        )
      }

      return selection
    },
    [element.id, element.formId, widgetMgr, fragmentId, originalNumRows]
  )

  return {
    editingState: editingStateRef,
    numRows,
    resetEditingState,
    updateNumRows,
    syncEditState,
    createSyncSelectionState,
    onFormCleared,
    loadInitialSelectionState,
    getProgrammaticSelectionState,
  }
}

export default useWidgetState
