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

import { CompactSelection } from "@glideapps/glide-data-grid"
import { act, renderHook } from "@testing-library/react"
import { Field, Utf8 } from "apache-arrow"

import { Dataframe as DataframeProto } from "@streamlit/protobuf"

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
          element: DataframeProto.create({
            editingMode: DataframeProto.EditingMode.FIXED,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [],
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
            element: DataframeProto.create({
              editingMode: DataframeProto.EditingMode.FIXED,
            }),
            widgetMgr: undefined,
            fragmentId: undefined,
            originalNumRows,
            originalColumns: [],
          }),
        { initialProps: { originalNumRows: 10 } }
      )

      expect(result.current.numRows).toBe(10)

      rerender({ originalNumRows: 20 })

      expect(result.current.numRows).toBe(20)
      expect(result.current.editingState.current.getNumRows()).toBe(20)
    })

    it("updateNumRows syncs component state with editing state", () => {
      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            editingMode: DataframeProto.EditingMode.DYNAMIC,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [createMockColumn("col1", 0)],
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
  })

  describe("syncEditState", () => {
    it("syncs editing state to widget manager with debounce", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.DYNAMIC,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 5,
          originalColumns: columns,
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.FIXED,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 5,
          originalColumns: [],
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.FIXED,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 0,
          originalColumns: columns,
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [],
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns: [],
        isRowSelectionActivated: false,
        isRequiredRowSelectionActivated: false,
        isColumnSelectionActivated: false,
        isCellSelectionActivated: false,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection).toBeUndefined()
    })

    it("returns undefined when widgetMgr is undefined", () => {
      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [],
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns: [],
        isRowSelectionActivated: true,
        isRequiredRowSelectionActivated: false,
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [],
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns: [],
        isRowSelectionActivated: true,
        isRequiredRowSelectionActivated: false,
        isColumnSelectionActivated: false,
        isCellSelectionActivated: false,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection).toBeUndefined()
    })

    it.each(["null", "1", "[]", "{}", '{"selection": null}'])(
      "returns undefined for invalid stored selection shape (%s)",
      invalidSelectionState => {
        const mockWidgetMgr = createMockWidgetMgr()
        mockWidgetMgr.getStringValue.mockReturnValue(invalidSelectionState)

        const { result } = renderHook(() =>
          useWidgetState({
            element: DataframeProto.create({
              id: "test-id",
              formId: "",
              editingMode: DataframeProto.EditingMode.READ_ONLY,
            }),
            widgetMgr: mockWidgetMgr as unknown as Parameters<
              typeof useWidgetState
            >[0]["widgetMgr"],
            fragmentId: undefined,
            originalNumRows: 10,
            originalColumns: [],
          })
        )

        const initialSelection = result.current.loadInitialSelectionState({
          columns: [],
          isRowSelectionActivated: true,
          isRequiredRowSelectionActivated: false,
          isColumnSelectionActivated: false,
          isCellSelectionActivated: false,
          isMultiCellSelectionActivated: false,
        })

        expect(initialSelection).toBeUndefined()
        expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
      }
    )

    it("loads selection default when no initial value is stored", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      mockWidgetMgr.getStringValue.mockReturnValue(undefined)
      const selectionDefault = JSON.stringify({
        selection: {
          rows: [1],
          columns: [],
          cells: [],
        },
      })
      const columns = [createMockColumn("col1", 0)]

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
            selectionDefault,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns,
        isRowSelectionActivated: true,
        isRequiredRowSelectionActivated: false,
        isColumnSelectionActivated: false,
        isCellSelectionActivated: false,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection).toBeDefined()
      expect(initialSelection?.rows.toArray()).toEqual([1])
      expect(initialSelection?.columns.length).toBe(0)
      expect(initialSelection?.current).toBeUndefined()
      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "test-id" }),
        selectionDefault,
        { fromUi: false },
        "test-fragment"
      )
    })

    it("prefers stored selection over selection default", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      mockWidgetMgr.getStringValue.mockReturnValue(
        JSON.stringify({
          selection: {
            rows: [0],
            columns: [],
            cells: [],
          },
        })
      )
      const selectionDefault = JSON.stringify({
        selection: {
          rows: [2],
          columns: [],
          cells: [],
        },
      })
      const columns = [createMockColumn("col1", 0)]

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
            selectionDefault,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns,
        isRowSelectionActivated: true,
        isRequiredRowSelectionActivated: false,
        isColumnSelectionActivated: false,
        isCellSelectionActivated: false,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection?.rows.toArray()).toEqual([0])
      expect(initialSelection?.rows.toArray()).not.toEqual([2])
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
    })

    it("skips selection default when programmatic selection is set", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const selectionDefault = JSON.stringify({
        selection: {
          rows: [1],
          columns: [],
          cells: [],
        },
      })

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
            selectionDefault,
            selectionState: selectionDefault,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: [],
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns: [],
        isRowSelectionActivated: true,
        isRequiredRowSelectionActivated: false,
        isColumnSelectionActivated: false,
        isCellSelectionActivated: false,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection).toBeUndefined()
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
    })
    it("auto-selects first row in single-row-required mode when no stored selection or default", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      mockWidgetMgr.getStringValue.mockReturnValue(undefined)
      const columns = [createMockColumn("col1", 0)]

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns,
        isRowSelectionActivated: true,
        isRequiredRowSelectionActivated: true,
        isColumnSelectionActivated: false,
        isCellSelectionActivated: false,
        isMultiCellSelectionActivated: false,
      })

      expect(initialSelection).toBeDefined()
      expect(initialSelection?.rows.toArray()).toEqual([0])
      expect(initialSelection?.columns.length).toBe(0)
      expect(initialSelection?.current).toBeUndefined()
      // Verify the selection was synced to the widget manager
      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "test-id" }),
        JSON.stringify({
          selection: {
            rows: [0],
            columns: [],
            cells: [],
          },
        }),
        { fromUi: false },
        "test-fragment"
      )
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns,
        isRowSelectionActivated: true,
        isRequiredRowSelectionActivated: false,
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns,
        isRowSelectionActivated: false,
        isRequiredRowSelectionActivated: false,
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const initialSelection = result.current.loadInitialSelectionState({
        columns,
        isRowSelectionActivated: false,
        isRequiredRowSelectionActivated: false,
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
          element: DataframeProto.create({
            editingMode: DataframeProto.EditingMode.DYNAMIC,
          }),
          widgetMgr: undefined,
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: [createMockColumn("col1", 0)],
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
    it("loads initial editing state from widget manager for editing mode", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]

      // Return a state with an added row
      mockWidgetMgr.getStringValue.mockReturnValue(
        JSON.stringify({
          edited_rows: {},
          added_rows: [{ col1: "test" }],
          deleted_rows: [],
        })
      )

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.DYNAMIC,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 5,
          originalColumns: columns,
        })
      )

      // Should have loaded the added row from widget state
      expect(result.current.numRows).toBe(6)
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
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 5,
          originalColumns: columns,
        })
      )

      // Should not have loaded the added row
      expect(result.current.numRows).toBe(5)
    })
  })

  describe("getProgrammaticSelectionState", () => {
    it("returns undefined when no selection modes are activated", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]
      const selectionStateStr = JSON.stringify({
        selection: { rows: [0, 1], columns: [], cells: [] },
      })

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const programmaticSelection =
        result.current.getProgrammaticSelectionState({
          selectionState: selectionStateStr,
          columns,
          isRowSelectionActivated: false,
          isColumnSelectionActivated: false,
          isCellSelectionActivated: false,
          isMultiCellSelectionActivated: false,
          getOriginalIndex: (idx: number) => idx,
        })

      expect(programmaticSelection).toBeUndefined()
    })

    it("returns row selection and syncs to widget manager", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]
      const selectionStateStr = JSON.stringify({
        selection: { rows: [0, 2], columns: [], cells: [] },
      })

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: "test-fragment",
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const programmaticSelection =
        result.current.getProgrammaticSelectionState({
          selectionState: selectionStateStr,
          columns,
          isRowSelectionActivated: true,
          isColumnSelectionActivated: false,
          isCellSelectionActivated: false,
          isMultiCellSelectionActivated: false,
          getOriginalIndex: (idx: number) => idx,
        })

      expect(programmaticSelection).toBeDefined()
      expect(programmaticSelection?.rows.toArray()).toEqual([0, 2])
      expect(programmaticSelection?.columns.length).toBe(0)

      // Should have synced to widget manager
      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "test-id" }),
        selectionStateStr,
        expect.objectContaining({ fromUi: false }),
        "test-fragment"
      )
    })

    it("returns column selection correctly", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [
        createMockColumn("col1", 0),
        createMockColumn("col2", 1),
      ]
      const selectionStateStr = JSON.stringify({
        selection: { rows: [], columns: ["col2"], cells: [] },
      })

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const programmaticSelection =
        result.current.getProgrammaticSelectionState({
          selectionState: selectionStateStr,
          columns,
          isRowSelectionActivated: false,
          isColumnSelectionActivated: true,
          isCellSelectionActivated: false,
          isMultiCellSelectionActivated: false,
          getOriginalIndex: (idx: number) => idx,
        })

      expect(programmaticSelection).toBeDefined()
      expect(programmaticSelection?.columns.toArray()).toEqual([1])
    })

    it("returns empty selection for clearing (not undefined)", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]
      const selectionStateStr = JSON.stringify({
        selection: { rows: [], columns: [], cells: [] },
      })

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const programmaticSelection =
        result.current.getProgrammaticSelectionState({
          selectionState: selectionStateStr,
          columns,
          isRowSelectionActivated: true,
          isColumnSelectionActivated: false,
          isCellSelectionActivated: false,
          isMultiCellSelectionActivated: false,
          getOriginalIndex: (idx: number) => idx,
        })

      // Should return empty selection, not undefined, to allow clearing
      expect(programmaticSelection).toBeDefined()
      expect(programmaticSelection?.rows.length).toBe(0)
      expect(programmaticSelection?.columns.length).toBe(0)
    })

    it("ignores invalid column names", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]
      const selectionStateStr = JSON.stringify({
        selection: { rows: [], columns: ["nonexistent"], cells: [] },
      })

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const programmaticSelection =
        result.current.getProgrammaticSelectionState({
          selectionState: selectionStateStr,
          columns,
          isRowSelectionActivated: false,
          isColumnSelectionActivated: true,
          isCellSelectionActivated: false,
          isMultiCellSelectionActivated: false,
          getOriginalIndex: (idx: number) => idx,
        })

      // Invalid column should be ignored (index would be -1)
      expect(programmaticSelection).toBeDefined()
      expect(programmaticSelection?.columns.length).toBe(0)
    })

    it("handles cell selection correctly", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [
        createMockColumn("col1", 0),
        createMockColumn("col2", 1),
      ]
      const selectionStateStr = JSON.stringify({
        selection: { rows: [], columns: [], cells: [[2, "col2"]] },
      })

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const programmaticSelection =
        result.current.getProgrammaticSelectionState({
          selectionState: selectionStateStr,
          columns,
          isRowSelectionActivated: false,
          isColumnSelectionActivated: false,
          isCellSelectionActivated: true,
          isMultiCellSelectionActivated: false,
          getOriginalIndex: (idx: number) => idx,
        })

      expect(programmaticSelection).toBeDefined()
      expect(programmaticSelection?.current?.cell).toEqual([1, 2])
      expect(programmaticSelection?.current?.range).toEqual({
        x: 1,
        y: 2,
        width: 1,
        height: 1,
      })
    })

    it("does not reconstruct cell selection in multi-cell mode", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [
        createMockColumn("col1", 0),
        createMockColumn("col2", 1),
      ]
      const selectionStateStr = JSON.stringify({
        selection: { rows: [], columns: [], cells: [[2, "col2"]] },
      })

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const programmaticSelection =
        result.current.getProgrammaticSelectionState({
          selectionState: selectionStateStr,
          columns,
          isRowSelectionActivated: false,
          isColumnSelectionActivated: false,
          isCellSelectionActivated: true,
          isMultiCellSelectionActivated: true,
          getOriginalIndex: (idx: number) => idx,
        })

      // Multi-cell mode should not reconstruct individual cell selections
      // because ranges cannot be properly reconstructed from cell positions
      expect(programmaticSelection).toBeDefined()
      expect(programmaticSelection?.current).toBeUndefined()
    })

    it("maps original row indices to display indices when sorted", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]
      // Backend sends original indices [0, 2]
      const selectionStateStr = JSON.stringify({
        selection: { rows: [0, 2], columns: [], cells: [] },
      })

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 5,
          originalColumns: columns,
        })
      )

      // Simulate a sorted grid where display order is reversed:
      // display 0 -> original 4, display 1 -> original 3,
      // display 2 -> original 2, display 3 -> original 1, display 4 -> original 0
      const getOriginalIndex = (displayIdx: number): number => 4 - displayIdx

      const programmaticSelection =
        result.current.getProgrammaticSelectionState({
          selectionState: selectionStateStr,
          columns,
          isRowSelectionActivated: true,
          isColumnSelectionActivated: false,
          isCellSelectionActivated: false,
          isMultiCellSelectionActivated: false,
          getOriginalIndex,
        })

      expect(programmaticSelection).toBeDefined()
      // Original row 0 -> display row 4, original row 2 -> display row 2
      expect(programmaticSelection?.rows.toArray()).toEqual([2, 4])
      // Verify it does NOT use raw original indices [0, 2]
      expect(programmaticSelection?.rows.toArray()).not.toEqual([0, 2])
    })

    it("maps original cell row index to display index when sorted", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [
        createMockColumn("col1", 0),
        createMockColumn("col2", 1),
      ]
      const selectionStateStr = JSON.stringify({
        // Cell at original row 3, col2
        selection: { rows: [], columns: [], cells: [[3, "col2"]] },
      })

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 5,
          originalColumns: columns,
        })
      )

      // Reversed sort: display 0 -> original 4, ..., display 1 -> original 3
      const getOriginalIndex = (displayIdx: number): number => 4 - displayIdx

      const programmaticSelection =
        result.current.getProgrammaticSelectionState({
          selectionState: selectionStateStr,
          columns,
          isRowSelectionActivated: false,
          isColumnSelectionActivated: false,
          isCellSelectionActivated: true,
          isMultiCellSelectionActivated: false,
          getOriginalIndex,
        })

      expect(programmaticSelection).toBeDefined()
      // Original row 3 -> display row 1 (since 4 - 1 = 3)
      expect(programmaticSelection?.current?.cell).toEqual([1, 1])
      // Verify it does NOT use raw original row index 3
      expect(programmaticSelection?.current?.cell).not.toEqual([1, 3])
    })

    it("returns undefined for malformed JSON selectionState", () => {
      const mockWidgetMgr = createMockWidgetMgr()
      const columns = [createMockColumn("col1", 0)]

      const { result } = renderHook(() =>
        useWidgetState({
          element: DataframeProto.create({
            id: "test-id",
            formId: "",
            editingMode: DataframeProto.EditingMode.READ_ONLY,
          }),
          widgetMgr: mockWidgetMgr as unknown as Parameters<
            typeof useWidgetState
          >[0]["widgetMgr"],
          fragmentId: undefined,
          originalNumRows: 10,
          originalColumns: columns,
        })
      )

      const programmaticSelection =
        result.current.getProgrammaticSelectionState({
          selectionState: "not-valid-json{{{",
          columns,
          isRowSelectionActivated: true,
          isColumnSelectionActivated: false,
          isCellSelectionActivated: false,
          isMultiCellSelectionActivated: false,
          getOriginalIndex: (idx: number) => idx,
        })

      // Should gracefully return undefined instead of throwing
      expect(programmaticSelection).toBeUndefined()
      // Should not persist malformed JSON to widget manager
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
    })

    it.each(["null", "1", "[]", "{}", '{"selection": null}'])(
      "returns undefined for valid JSON with invalid shape (%s)",
      invalidSelectionState => {
        const mockWidgetMgr = createMockWidgetMgr()
        const columns = [createMockColumn("col1", 0)]

        const { result } = renderHook(() =>
          useWidgetState({
            element: DataframeProto.create({
              id: "test-id",
              formId: "",
              editingMode: DataframeProto.EditingMode.READ_ONLY,
            }),
            widgetMgr: mockWidgetMgr as unknown as Parameters<
              typeof useWidgetState
            >[0]["widgetMgr"],
            fragmentId: undefined,
            originalNumRows: 10,
            originalColumns: columns,
          })
        )

        const programmaticSelection =
          result.current.getProgrammaticSelectionState({
            selectionState: invalidSelectionState,
            columns,
            isRowSelectionActivated: true,
            isColumnSelectionActivated: false,
            isCellSelectionActivated: false,
            isMultiCellSelectionActivated: false,
            getOriginalIndex: (idx: number) => idx,
          })

        expect(programmaticSelection).toBeUndefined()
        expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
      }
    )
  })
})
