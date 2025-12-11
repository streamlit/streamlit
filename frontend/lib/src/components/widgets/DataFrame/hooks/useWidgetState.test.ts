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

import { CompactSelection } from "@glideapps/glide-data-grid"
import { act, renderHook } from "@testing-library/react"
import { Field, Utf8 } from "apache-arrow"

import { Arrow as ArrowProto } from "@streamlit/protobuf"

import { TextColumn } from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import useWidgetState from "./useWidgetState"

const createMockWidgetMgr = (): {
  getStringValue: ReturnType<typeof vi.fn>
  setStringValue: ReturnType<typeof vi.fn>
} => ({
  getStringValue: vi.fn(),
  setStringValue: vi.fn(),
})

const createMockColumn = (
  name: string,
  indexNumber: number,
  isIndex = false
): ReturnType<typeof TextColumn> =>
  TextColumn({
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field(name, new Utf8(), true),
      pandasType: {
        field_name: name,
        name: name,
        pandas_type: "unicode",
        numpy_type: "unicode",
        metadata: null,
      },
    },
    id: name,
    name: name,
    indexNumber,
    isEditable: true,
    isHidden: false,
    isIndex,
    isPinned: false,
    isStretched: false,
    title: name,
  })

describe("useWidgetState hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("editing state management", () => {
    it("initializes editingState and numRows correctly", () => {
      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            editingMode: ArrowProto.EditingMode.FIXED,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [],
          dataHash: "hash1",
        })
      )

      expect(result.current.numRows).toBe(10)
      expect(result.current.editingState.current).toBeDefined()
      expect(result.current.editingState.current.getNumRows()).toBe(10)
    })

    it("resets editingState when originalNumRows changes", () => {
      const { result, rerender } = renderHook(
        ({ originalNumRows }) =>
          useWidgetState({
            element: ArrowProto.create({
              editingMode: ArrowProto.EditingMode.FIXED,
            }),
            widgetMgr: undefined,
            fragmentId: undefined,
            originalNumRows,
            originalColumns: [],
            dataHash: "hash1",
          }),
        { initialProps: { originalNumRows: 10 } }
      )

      expect(result.current.numRows).toBe(10)

      rerender({ originalNumRows: 20 })

      expect(result.current.numRows).toBe(20)
      expect(result.current.editingState.current.getNumRows()).toBe(20)
    })

    it("resets editingState when dataHash changes (data content changed)", () => {
      // This tests the fix for issue #7749 - when data values change
      // (e.g., a computed column is updated), the editing state should reset
      // so that the component reflects the new source data.
      const { result, rerender } = renderHook(
        ({ dataHash }) =>
          useWidgetState({
            element: ArrowProto.create({
              editingMode: ArrowProto.EditingMode.DYNAMIC,
            }),
            widgetMgr: undefined,
            fragmentId: undefined,
            originalNumRows: 10,
            originalColumns: [createMockColumn("col1", 0)],
            dataHash,
          }),
        { initialProps: { dataHash: "hash1" } }
      )

      // Make an edit to the editing state
      act(() => {
        result.current.editingState.current.addRow(new Map())
        result.current.updateNumRows()
      })

      // Verify the edit was applied
      expect(result.current.numRows).toBe(11)
      expect(result.current.editingState.current.getNumRows()).toBe(11)

      // Capture the current editingState reference
      const oldEditingState = result.current.editingState.current

      // Simulate data content change (e.g., computed column updated)
      rerender({ dataHash: "hash2" })

      // Editing state should be reset to a fresh state with original row count
      expect(result.current.numRows).toBe(10)
      expect(result.current.editingState.current.getNumRows()).toBe(10)

      // Verify it's actually a new EditingState instance
      expect(result.current.editingState.current).not.toBe(oldEditingState)
    })

    it("updateNumRows syncs component state with editing state", () => {
      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            editingMode: ArrowProto.EditingMode.DYNAMIC,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [createMockColumn("col1", 0)],
          dataHash: "hash1",
        })
      )

      expect(result.current.numRows).toBe(10)

      // Simulate adding a row directly to editing state
      act(() => {
        result.current.editingState.current.addRow(new Map())
      })

      // numRows in component should still be 10 until updateNumRows is called
      expect(result.current.numRows).toBe(10)

      // Call updateNumRows to sync
      act(() => {
        result.current.updateNumRows()
      })

      expect(result.current.numRows).toBe(11)
    })

    it("reconciles editingState when user-initiated row deletion matches new row count", () => {
      // Phase 2 test: When user deletes a row via UI, and the new source data
      // has the expected row count (original - deleted), edits should be reconciled.
      const { result, rerender } = renderHook(
        ({ originalNumRows, dataHash }) =>
          useWidgetState({
            element: ArrowProto.create({
              editingMode: ArrowProto.EditingMode.DYNAMIC,
            }),
            widgetMgr: undefined,
            fragmentId: undefined,
            originalNumRows,
            originalColumns: [createMockColumn("col1", 0)],
            dataHash,
          }),
        { initialProps: { originalNumRows: 5, dataHash: "hash1" } }
      )

      // User deletes row 1 via UI
      act(() => {
        result.current.editingState.current.deleteRow(1)
        result.current.updateNumRows()
      })

      expect(result.current.numRows).toBe(4) // 5 - 1 deleted = 4

      // Source data now has 4 rows (deletion was applied to backend)
      // This simulates the rerun after the delete is saved to session state
      rerender({ originalNumRows: 4, dataHash: "hash2" })

      // State should be reconciled (not reset) because row count matches expected
      expect(result.current.numRows).toBe(4)
      // deletedRows should be cleared after reconciliation
      expect(result.current.editingState.current.getDeletedRows()).toEqual([])
    })

    it("resets editingState when external row change detected", () => {
      // Phase 2 test: When row count changes but doesn't match user edits,
      // state should reset (external change detected).
      const { result, rerender } = renderHook(
        ({ originalNumRows, dataHash }) =>
          useWidgetState({
            element: ArrowProto.create({
              editingMode: ArrowProto.EditingMode.DYNAMIC,
            }),
            widgetMgr: undefined,
            fragmentId: undefined,
            originalNumRows,
            originalColumns: [createMockColumn("col1", 0)],
            dataHash,
          }),
        { initialProps: { originalNumRows: 5, dataHash: "hash1" } }
      )

      // User deletes row 1 via UI (expected new count = 4)
      act(() => {
        result.current.editingState.current.deleteRow(1)
        result.current.updateNumRows()
      })

      expect(result.current.numRows).toBe(4)

      // External change: source data now has 3 rows (unexpected!)
      // This doesn't match expected 4 rows, so it's an external change
      rerender({ originalNumRows: 3, dataHash: "hash2" })

      // State should be reset because external change detected
      expect(result.current.numRows).toBe(3)
      expect(result.current.editingState.current.getOriginalNumRows()).toBe(3)
    })
  })

  describe("syncEditState", () => {
    it("syncs editing state to widget manager with debounce", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.DYNAMIC,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 5,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      // Make an edit to create a difference from the empty initial state
      act(() => {
        result.current.editingState.current.addRow(new Map())
        result.current.updateNumRows()
      })

      // Call syncEditState multiple times
      act(() => {
        result.current.syncEditState()
        result.current.syncEditState()
        result.current.syncEditState()
      })

      // Should not have called setStringValue yet due to debounce
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()

      // Advance timers to trigger debounce
      act(() => {
        vi.advanceTimersByTime(200)
      })

      // Now it should have been called once (debounce coalesces multiple calls)
      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    })

    it("does not throw if widgetMgr is undefined", () => {
      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.FIXED,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 5,
          originalColumns: [],
          dataHash: "hash1",
        })
      )

      // Should not throw when calling syncEditState without a widgetMgr
      expect(() => {
        act(() => {
          result.current.syncEditState()
          vi.advanceTimersByTime(200)
        })
      }).not.toThrow()
    })

    it("does not update widget state if no changes", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]

      // Mock getStringValue to return the current state
      mockWidgetMgr.getStringValue.mockReturnValue(
        JSON.stringify({ edited_rows: {}, added_rows: [], deleted_rows: [] })
      )

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.FIXED,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 0,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      act(() => {
        result.current.syncEditState()
        vi.advanceTimersByTime(200)
      })

      // Should not have called setStringValue since state hasn't changed
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
    })
  })

  describe("createSyncSelectionState", () => {
    it("creates a function that syncs selection state", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [
        createMockColumn("index", 0, true),
        createMockColumn("col1", 1),
      ]

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      // Create sync function with columns and identity getOriginalIndex
      const syncSelectionState = result.current.createSyncSelectionState(
        columns,
        (idx: number) => idx
      )

      // Call with a row selection
      const selection = {
        rows: CompactSelection.fromSingleSelection(0),
        columns: CompactSelection.empty(),
        current: undefined,
      }

      act(() => {
        syncSelectionState(selection, false)
      })

      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "test-id" }),
        expect.stringContaining('"rows":[0]'),
        expect.anything(),
        "test-fragment"
      )
    })

    it("handles column selection correctly", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [
        createMockColumn("col1", 0),
        createMockColumn("col2", 1),
      ]

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      const syncSelectionState = result.current.createSyncSelectionState(
        columns,
        (idx: number) => idx
      )

      // Call with a column selection
      const selection = {
        rows: CompactSelection.empty(),
        columns: CompactSelection.fromSingleSelection(1),
        current: undefined,
      }

      act(() => {
        syncSelectionState(selection, false)
      })

      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "test-id" }),
        expect.stringContaining('"columns":["col2"]'),
        expect.anything(),
        "test-fragment"
      )
    })

    it("handles cell selection when syncCellSelections is true", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [
        createMockColumn("col1", 0),
        createMockColumn("col2", 1),
      ]

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      const syncSelectionState = result.current.createSyncSelectionState(
        columns,
        (idx: number) => idx
      )

      // Call with a cell selection
      const selection = {
        rows: CompactSelection.empty(),
        columns: CompactSelection.empty(),
        current: {
          cell: [1, 2] as [number, number],
          range: { x: 1, y: 2, width: 1, height: 1 },
          rangeStack: [],
        },
      }

      act(() => {
        syncSelectionState(selection, true)
      })

      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "test-id" }),
        expect.stringContaining('"cells":[[2,"col2"]]'),
        expect.anything(),
        "test-fragment"
      )
    })

    it("does not include cell selection when syncCellSelections is false", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      const syncSelectionState = result.current.createSyncSelectionState(
        columns,
        (idx: number) => idx
      )

      const selection = {
        rows: CompactSelection.empty(),
        columns: CompactSelection.empty(),
        current: {
          cell: [0, 0] as [number, number],
          range: { x: 0, y: 0, width: 1, height: 1 },
          rangeStack: [],
        },
      }

      act(() => {
        syncSelectionState(selection, false)
      })

      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "test-id" }),
        expect.stringContaining('"cells":[]'),
        expect.anything(),
        "test-fragment"
      )
    })

    it("uses getOriginalIndex for row selection mapping", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      // Create sync function with a custom getOriginalIndex that maps 0 -> 5
      const syncSelectionState = result.current.createSyncSelectionState(
        columns,
        (idx: number) => idx + 5
      )

      const selection = {
        rows: CompactSelection.fromSingleSelection(0),
        columns: CompactSelection.empty(),
        current: undefined,
      }

      act(() => {
        syncSelectionState(selection, false)
      })

      // Should use the mapped index (5) instead of visual index (0)
      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('"rows":[5]'),
        expect.anything(),
        expect.anything()
      )
    })
  })

  describe("loadInitialSelectionState", () => {
    it("returns undefined when no selection modes are activated", () => {
      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [],
          dataHash: "hash1",
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns: [],
        isRowSelectionActivated: false,
        isColumnSelectionActivated: false,
        isCellSelectionActivated: false,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection).toBeUndefined()
    })

    it("returns undefined when widgetMgr is undefined", () => {
      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [],
          dataHash: "hash1",
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns: [],
        isRowSelectionActivated: true,
        isColumnSelectionActivated: false,
        isCellSelectionActivated: false,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection).toBeUndefined()
    })

    it("returns undefined when no initial value is stored", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      mockWidgetMgr.getStringValue.mockReturnValue(undefined)

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [],
          dataHash: "hash1",
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns: [],
        isRowSelectionActivated: true,
        isColumnSelectionActivated: false,
        isCellSelectionActivated: false,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection).toBeUndefined()
    })

    it("loads initial row selection", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      mockWidgetMgr.getStringValue.mockReturnValue(
        JSON.stringify({
          selection: {
            rows: [0, 2],
            columns: [],
            cells: [],
          },
        })
      )

      const columns = [createMockColumn("col1", 0)]

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns,
        isRowSelectionActivated: true,
        isColumnSelectionActivated: false,
        isCellSelectionActivated: false,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection).toBeDefined()
      expect(initialSelection?.rows.toArray()).toEqual([0, 2])
      expect(initialSelection?.columns.length).toBe(0)
      expect(initialSelection?.current).toBeUndefined()
    })

    it("loads initial column selection", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      mockWidgetMgr.getStringValue.mockReturnValue(
        JSON.stringify({
          selection: {
            rows: [],
            columns: ["col2"],
            cells: [],
          },
        })
      )

      const columns = [
        createMockColumn("col1", 0),
        createMockColumn("col2", 1),
      ]

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns,
        isRowSelectionActivated: false,
        isColumnSelectionActivated: true,
        isCellSelectionActivated: false,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection).toBeDefined()
      expect(initialSelection?.rows.length).toBe(0)
      expect(initialSelection?.columns.toArray()).toEqual([1])
    })

    it("loads initial cell selection for single cell mode", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      mockWidgetMgr.getStringValue.mockReturnValue(
        JSON.stringify({
          selection: {
            rows: [],
            columns: [],
            cells: [[2, "col1"]],
          },
        })
      )

      const columns = [createMockColumn("col1", 0)]

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns,
        isRowSelectionActivated: false,
        isColumnSelectionActivated: false,
        isCellSelectionActivated: true,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection).toBeDefined()
      expect(initialSelection?.current?.cell).toEqual([0, 2])
      expect(initialSelection?.current?.range).toEqual({
        x: 0,
        y: 2,
        width: 1,
        height: 1,
      })
    })
  })

  describe("onFormCleared", () => {
    it("resets the editing state", () => {
      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            editingMode: ArrowProto.EditingMode.DYNAMIC,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [createMockColumn("col1", 0)],
          dataHash: "hash1",
        })
      )

      // Add a row to editing state
      act(() => {
        result.current.editingState.current.addRow(new Map())
        result.current.updateNumRows()
      })

      expect(result.current.numRows).toBe(11)

      // Call onFormCleared
      act(() => {
        result.current.onFormCleared()
      })

      expect(result.current.numRows).toBe(10)
    })
  })

  describe("initial editing state loading", () => {
    it("loads cell edits but not row changes from widget manager", () => {
      // Row additions/deletions are NOT restored on initial load to prevent
      // double-application bugs (e.g., user saves to session_state, then
      // on next rerun the deletion would be re-applied to wrong row).
      // Only cell edits are safely restorable.
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]

      // Return a state with cell edits and row changes
      mockWidgetMgr.getStringValue.mockReturnValue(
        JSON.stringify({
          edited_rows: { 0: { col1: "edited" } },
          added_rows: [{ col1: "test" }],
          deleted_rows: [1],
        })
      )

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.DYNAMIC,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 5,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      // Row count should NOT change - added/deleted rows are not restored
      expect(result.current.numRows).toBe(5)
      // But cell edits should be restored (they're safe to re-apply)
      expect(result.current.editingState.current.getCell(0, 0)).toBeDefined()
    })

    it("loads all state if no row changes are present", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]

      // Return a state with only cell edits (no row changes)
      mockWidgetMgr.getStringValue.mockReturnValue(
        JSON.stringify({
          edited_rows: { 0: { col1: "edited" } },
          added_rows: [],
          deleted_rows: [],
        })
      )

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.DYNAMIC,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 5,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      // Row count should stay the same (no row changes)
      expect(result.current.numRows).toBe(5)
      // Cell edits should be restored
      expect(result.current.editingState.current.getCell(0, 0)).toBeDefined()
    })

    it("does not load editing state for read-only mode", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]

      mockWidgetMgr.getStringValue.mockReturnValue(
        JSON.stringify({
          edited_rows: {},
          added_rows: [{ col1: "test" }],
          deleted_rows: [],
        })
      )

      const { result } = renderHook(() =>
        useWidgetState({
          element: ArrowProto.create({
            id: "test-id",
            formId: "",
            editingMode: ArrowProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 5,
          originalColumns: columns,
          dataHash: "hash1",
        })
      )

      // Should not have loaded the added row
      expect(result.current.numRows).toBe(5)
    })
  })
})
