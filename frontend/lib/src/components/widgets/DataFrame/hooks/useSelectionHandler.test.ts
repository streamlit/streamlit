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

import useSelectionHandler from "./useSelectionHandler"

const syncSelectionStateMock = vi.fn()

describe("useSelectionHandler hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    {
      name: "single row",
      modes: [DataframeProto.SelectionMode.SINGLE_ROW],
      isRow: true,
      isMultiRow: false,
      isCol: false,
      isMultiCol: false,
      isCell: false,
      isMultiCell: false,
    },
    {
      name: "multi row",
      modes: [DataframeProto.SelectionMode.MULTI_ROW],
      isRow: true,
      isMultiRow: true,
      isCol: false,
      isMultiCol: false,
      isCell: false,
      isMultiCell: false,
    },
    {
      name: "single column",
      modes: [DataframeProto.SelectionMode.SINGLE_COLUMN],
      isRow: false,
      isMultiRow: false,
      isCol: true,
      isMultiCol: false,
      isCell: false,
      isMultiCell: false,
    },
    {
      name: "multi column",
      modes: [DataframeProto.SelectionMode.MULTI_COLUMN],
      isRow: false,
      isMultiRow: false,
      isCol: true,
      isMultiCol: true,
      isCell: false,
      isMultiCell: false,
    },
    {
      name: "single cell",
      modes: [DataframeProto.SelectionMode.SINGLE_CELL],
      isRow: false,
      isMultiRow: false,
      isCol: false,
      isMultiCol: false,
      isCell: true,
      isMultiCell: false,
    },
    {
      name: "multi cell",
      modes: [DataframeProto.SelectionMode.MULTI_CELL],
      isRow: false,
      isMultiRow: false,
      isCol: false,
      isMultiCol: false,
      isCell: true,
      isMultiCell: true,
    },
    {
      name: "mixed multi row+column",
      modes: [
        DataframeProto.SelectionMode.MULTI_ROW,
        DataframeProto.SelectionMode.MULTI_COLUMN,
      ],
      isRow: true,
      isMultiRow: true,
      isCol: true,
      isMultiCol: true,
      isCell: false,
      isMultiCell: false,
    },
  ])(
    "detects $name selection",
    ({ modes, isRow, isMultiRow, isCol, isMultiCol, isCell, isMultiCell }) => {
      const { result } = renderHook(() =>
        useSelectionHandler(
          DataframeProto.create({ selectionMode: modes }),
          false,
          false,
          [],
          syncSelectionStateMock
        )
      )

      expect(result.current.isRowSelectionActivated).toEqual(isRow)
      expect(result.current.isMultiRowSelectionActivated).toEqual(isMultiRow)
      expect(result.current.isColumnSelectionActivated).toEqual(isCol)
      expect(result.current.isMultiColumnSelectionActivated).toEqual(
        isMultiCol
      )
      expect(result.current.isCellSelectionActivated).toEqual(isCell)
      expect(result.current.isMultiCellSelectionActivated).toEqual(isMultiCell)
    }
  )

  it.each([
    { name: "empty table", isEmpty: true, isDisabled: false },
    { name: "disabled table", isEmpty: false, isDisabled: true },
  ])("disables all selections if $name", ({ isEmpty, isDisabled }) => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        DataframeProto.create({
          selectionMode: [
            DataframeProto.SelectionMode.MULTI_ROW,
            DataframeProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        isEmpty,
        isDisabled,
        [],
        syncSelectionStateMock
      )
    )

    expect(result.current.isRowSelectionActivated).toEqual(false)
    expect(result.current.isMultiRowSelectionActivated).toEqual(false)
    expect(result.current.isColumnSelectionActivated).toEqual(false)
    expect(result.current.isMultiColumnSelectionActivated).toEqual(false)
    expect(result.current.isCellSelectionActivated).toEqual(false)
    expect(result.current.isMultiCellSelectionActivated).toEqual(false)
  })
  it("correctly processes and clears column selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        DataframeProto.create({
          selectionMode: [
            DataframeProto.SelectionMode.MULTI_ROW,
            DataframeProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    expect(result.current.isRowSelectionActivated).toEqual(true)
    expect(result.current.isMultiRowSelectionActivated).toEqual(true)
    expect(result.current.isColumnSelectionActivated).toEqual(true)
    expect(result.current.isMultiColumnSelectionActivated).toEqual(true)

    // Process a new selection with a single column selected:
    const newGridSelection = {
      columns: CompactSelection.fromSingleSelection(0),
      rows: CompactSelection.empty(),
      current: undefined,
    }

    act(() => {
      const { processSelectionChange } = result.current
      processSelectionChange?.(newGridSelection)
    })

    // Check that it detects a column to be selected:
    expect(result.current.isColumnSelected).toEqual(true)

    expect(result.current.isRowSelected).toEqual(false)
    expect(result.current.isCellSelected).toEqual(false)

    expect(result.current.gridSelection).toEqual(newGridSelection)

    expect(syncSelectionStateMock).toBeCalledTimes(1)

    // Check that the selection can also be cleared again:
    act(() => {
      const { clearSelection } = result.current
      clearSelection?.()
    })

    // Check that it clears the selection:
    expect(result.current.isRowSelected).toEqual(false)
    expect(result.current.isColumnSelected).toEqual(false)
    expect(result.current.isCellSelected).toEqual(false)

    expect(syncSelectionStateMock).toBeCalledTimes(2)
  })
  it("correctly processes and clears row selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        DataframeProto.create({
          selectionMode: [
            DataframeProto.SelectionMode.MULTI_ROW,
            DataframeProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    expect(result.current.isRowSelectionActivated).toEqual(true)
    expect(result.current.isMultiRowSelectionActivated).toEqual(true)
    expect(result.current.isColumnSelectionActivated).toEqual(true)
    expect(result.current.isMultiColumnSelectionActivated).toEqual(true)

    // Process a new selection with a single row selected:
    const newGridSelection = {
      columns: CompactSelection.empty(),
      rows: CompactSelection.fromSingleSelection(0),
      current: undefined,
    }
    act(() => {
      const { processSelectionChange } = result.current
      processSelectionChange?.(newGridSelection)
    })

    // Check that it detects a row to be selected:
    expect(result.current.isRowSelected).toEqual(true)

    expect(result.current.isColumnSelected).toEqual(false)
    expect(result.current.isCellSelected).toEqual(false)

    expect(result.current.gridSelection).toEqual(newGridSelection)

    expect(syncSelectionStateMock).toBeCalledTimes(1)

    // Check that the selection can also be cleared again:
    act(() => {
      const { clearSelection } = result.current
      clearSelection?.()
    })

    // Check that it clears the selection:
    expect(result.current.isRowSelected).toEqual(false)
    expect(result.current.isColumnSelected).toEqual(false)
    expect(result.current.isCellSelected).toEqual(false)

    expect(syncSelectionStateMock).toBeCalledTimes(2)
  })
  it("correctly processes and clears row+column selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        DataframeProto.create({
          selectionMode: [
            DataframeProto.SelectionMode.MULTI_ROW,
            DataframeProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    expect(result.current.isRowSelectionActivated).toEqual(true)
    expect(result.current.isMultiRowSelectionActivated).toEqual(true)
    expect(result.current.isColumnSelectionActivated).toEqual(true)
    expect(result.current.isMultiColumnSelectionActivated).toEqual(true)

    const newGridSelection = {
      columns: CompactSelection.fromSingleSelection(0),
      rows: CompactSelection.fromSingleSelection(0),
      current: undefined,
    }

    // Process a new selection with a row and column:
    act(() => {
      const { processSelectionChange } = result.current
      processSelectionChange?.(newGridSelection)
    })

    // Check that it detects a row+column to be selected:
    expect(result.current.isRowSelected).toEqual(true)
    expect(result.current.isColumnSelected).toEqual(true)

    expect(result.current.isCellSelected).toEqual(false)

    expect(result.current.gridSelection).toEqual(newGridSelection)

    expect(syncSelectionStateMock).toBeCalledTimes(1)

    // Check that the clear cell selections doesn't clear the row+column selection:
    act(() => {
      const { clearSelection } = result.current
      // Keep column & row selections:
      clearSelection?.(true, true)
    })
    expect(result.current.isRowSelected).toEqual(true)
    expect(result.current.isColumnSelected).toEqual(true)
    expect(result.current.isCellSelected).toEqual(false)
    // This should not call syncSelectionState callback:
    expect(syncSelectionStateMock).toBeCalledTimes(1)

    // Check that the selection can also be cleared again:
    act(() => {
      const { clearSelection } = result.current
      clearSelection?.()
    })

    // Check that it clears the selection:
    expect(result.current.isRowSelected).toEqual(false)
    expect(result.current.isColumnSelected).toEqual(false)
    expect(result.current.isCellSelected).toEqual(false)

    expect(syncSelectionStateMock).toBeCalledTimes(2)
  })

  it("clearSelection keeps only columns and syncs", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        DataframeProto.create({
          selectionMode: [
            DataframeProto.SelectionMode.MULTI_ROW,
            DataframeProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    const newGridSelection = {
      columns: CompactSelection.fromSingleSelection(0),
      rows: CompactSelection.fromSingleSelection(0),
      current: undefined,
    }

    act(() => {
      const { processSelectionChange } = result.current
      processSelectionChange?.(newGridSelection)
    })

    expect(result.current.isRowSelected).toEqual(true)
    expect(result.current.isColumnSelected).toEqual(true)
    expect(syncSelectionStateMock).toBeCalledTimes(1)

    act(() => {
      const { clearSelection } = result.current
      // Clear rows, keep columns
      clearSelection?.(false, true)
    })

    expect(result.current.isRowSelected).toEqual(false)
    expect(result.current.isColumnSelected).toEqual(true)
    expect(result.current.isCellSelected).toEqual(false)
    expect(syncSelectionStateMock).toBeCalledTimes(2)
  })

  it("clearSelection keeps only rows and syncs", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        DataframeProto.create({
          selectionMode: [
            DataframeProto.SelectionMode.MULTI_ROW,
            DataframeProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    const newGridSelection = {
      columns: CompactSelection.fromSingleSelection(0),
      rows: CompactSelection.fromSingleSelection(0),
      current: undefined,
    }

    act(() => {
      const { processSelectionChange } = result.current
      processSelectionChange?.(newGridSelection)
    })

    expect(result.current.isRowSelected).toEqual(true)
    expect(result.current.isColumnSelected).toEqual(true)
    expect(syncSelectionStateMock).toBeCalledTimes(1)

    act(() => {
      const { clearSelection } = result.current
      // Keep rows, clear columns
      clearSelection?.(true, false)
    })

    expect(result.current.isRowSelected).toEqual(true)
    expect(result.current.isColumnSelected).toEqual(false)
    expect(result.current.isCellSelected).toEqual(false)
    expect(syncSelectionStateMock).toBeCalledTimes(2)
  })

  it("correctly processes and clears cell selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        DataframeProto.create({
          selectionMode: [
            DataframeProto.SelectionMode.MULTI_ROW,
            DataframeProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    const newGridSelection = {
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
      current: {
        cell: [0, 0],
      },
    }
    // Process a new cell selection:
    act(() => {
      const { processSelectionChange } = result.current
      // @ts-expect-error
      processSelectionChange?.(newGridSelection)
    })

    // Check that it detects a row+column to be selected:
    expect(result.current.isCellSelected).toEqual(true)

    expect(result.current.isRowSelected).toEqual(false)
    expect(result.current.isColumnSelected).toEqual(false)

    expect(result.current.gridSelection).toEqual(newGridSelection)

    expect(syncSelectionStateMock).not.toBeCalled()

    // Check that the clear cell selections doesn't clear the row+column selection:
    act(() => {
      const { clearSelection } = result.current
      clearSelection?.(true, true)
    })
    expect(result.current.isRowSelected).toEqual(false)
    expect(result.current.isColumnSelected).toEqual(false)
    expect(result.current.isCellSelected).toEqual(false)
    // This should not call syncSelectionState callback:
    expect(syncSelectionStateMock).not.toBeCalled()
  })
  it("correctly processes and clears cell selection when cell selection is activated", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        DataframeProto.create({
          selectionMode: [DataframeProto.SelectionMode.MULTI_CELL],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    const newGridSelection = {
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
      current: {
        cell: [0, 0],
      },
    }
    // Process a new cell selection:
    act(() => {
      const { processSelectionChange } = result.current
      // @ts-expect-error
      processSelectionChange?.(newGridSelection)
    })

    expect(result.current.isCellSelected).toEqual(true)
    expect(result.current.isRowSelected).toEqual(false)
    expect(result.current.isColumnSelected).toEqual(false)

    expect(result.current.gridSelection).toEqual(newGridSelection)

    expect(syncSelectionStateMock).toBeCalledTimes(1)
    expect(syncSelectionStateMock).toHaveBeenLastCalledWith(
      expect.anything(),
      true
    )

    // Clear the selection completely:
    act(() => {
      const { clearSelection } = result.current
      clearSelection?.()
    })

    expect(result.current.isRowSelected).toEqual(false)
    expect(result.current.isColumnSelected).toEqual(false)
    expect(result.current.isCellSelected).toEqual(false)

    expect(syncSelectionStateMock).toBeCalledTimes(2)
    expect(syncSelectionStateMock).toHaveBeenLastCalledWith(
      expect.anything(),
      true
    )
  })

  it("ignores index column selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        DataframeProto.create({
          selectionMode: [
            DataframeProto.SelectionMode.MULTI_ROW,
            DataframeProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        false,
        false,
        [
          // Configure 1 index column
          TextColumn({
            arrowType: {
              type: DataFrameCellType.DATA,
              arrowField: new Field("index-0", new Utf8(), true),
              pandasType: {
                field_name: "index-0",
                name: "index-0",
                pandas_type: "unicode",
                numpy_type: "unicode",
                metadata: null,
              },
            },
            id: "index-0",
            name: "",
            indexNumber: 0,
            isEditable: true,
            isHidden: false,
            isIndex: true,
            isPinned: false,
            isStretched: false,
            title: "",
          }),
        ],
        syncSelectionStateMock
      )
    )

    // Select the index column:
    const firstGridSelection = {
      columns: CompactSelection.fromSingleSelection(0),
      rows: CompactSelection.empty(),
      cell: undefined,
    }
    act(() => {
      const { processSelectionChange } = result.current
      processSelectionChange?.(firstGridSelection)
    })

    // Nothing should have been selected since the index column is ignored:
    expect(result.current.isCellSelected).toEqual(false)
    expect(result.current.isRowSelected).toEqual(false)
    expect(result.current.isColumnSelected).toEqual(false)
  })

  describe("single-row-required mode", () => {
    it("detects single-row-required selection mode", () => {
      const { result } = renderHook(() =>
        useSelectionHandler(
          DataframeProto.create({
            selectionMode: [DataframeProto.SelectionMode.SINGLE_ROW_REQUIRED],
          }),
          false,
          false,
          [],
          syncSelectionStateMock
        )
      )

      expect(result.current.isRowSelectionActivated).toEqual(true)
      expect(result.current.isRequiredRowSelectionActivated).toEqual(true)
      expect(result.current.isMultiRowSelectionActivated).toEqual(false)
    })

    it("prevents clearing row selection in single-row-required mode", () => {
      const { result } = renderHook(() =>
        useSelectionHandler(
          DataframeProto.create({
            selectionMode: [DataframeProto.SelectionMode.SINGLE_ROW_REQUIRED],
          }),
          false,
          false,
          [],
          syncSelectionStateMock
        )
      )

      // First, select a row
      const selectionWithRow = {
        columns: CompactSelection.empty(),
        rows: CompactSelection.fromSingleSelection(1),
        current: undefined,
      }

      act(() => {
        result.current.processSelectionChange(selectionWithRow)
      })

      expect(result.current.isRowSelected).toEqual(true)
      expect(result.current.gridSelection.rows.toArray()).toEqual([1])

      // Try to clear the row selection
      const emptySelection = {
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
        current: undefined,
      }

      act(() => {
        result.current.processSelectionChange(emptySelection)
      })

      // The row selection should be preserved
      expect(result.current.isRowSelected).toEqual(true)
      expect(result.current.gridSelection.rows.toArray()).toEqual([1])
    })

    it("allows changing row selection in single-row-required mode", () => {
      const { result } = renderHook(() =>
        useSelectionHandler(
          DataframeProto.create({
            selectionMode: [DataframeProto.SelectionMode.SINGLE_ROW_REQUIRED],
          }),
          false,
          false,
          [],
          syncSelectionStateMock
        )
      )

      // First, select row 1
      const firstSelection = {
        columns: CompactSelection.empty(),
        rows: CompactSelection.fromSingleSelection(1),
        current: undefined,
      }

      act(() => {
        result.current.processSelectionChange(firstSelection)
      })

      expect(result.current.gridSelection.rows.toArray()).toEqual([1])

      // Change selection to row 2
      const secondSelection = {
        columns: CompactSelection.empty(),
        rows: CompactSelection.fromSingleSelection(2),
        current: undefined,
      }

      act(() => {
        result.current.processSelectionChange(secondSelection)
      })

      // The selection should be changed to row 2
      expect(result.current.gridSelection.rows.toArray()).toEqual([2])
    })

    it("clearSelection preserves row selection in single-row-required mode", () => {
      const { result } = renderHook(() =>
        useSelectionHandler(
          DataframeProto.create({
            selectionMode: [DataframeProto.SelectionMode.SINGLE_ROW_REQUIRED],
          }),
          false,
          false,
          [],
          syncSelectionStateMock
        )
      )

      // First, select a row
      const selectionWithRow = {
        columns: CompactSelection.empty(),
        rows: CompactSelection.fromSingleSelection(2),
        current: undefined,
      }

      act(() => {
        result.current.processSelectionChange(selectionWithRow)
      })

      expect(result.current.isRowSelected).toEqual(true)
      expect(result.current.gridSelection.rows.toArray()).toEqual([2])
      expect(syncSelectionStateMock).toBeCalledTimes(1)

      // Try to clear all selections via clearSelection()
      // This simulates what happens when a user sorts a column
      act(() => {
        result.current.clearSelection()
      })

      // The row selection should be preserved because single-row-required
      // mode requires that a row always remains selected
      expect(result.current.isRowSelected).toEqual(true)
      expect(result.current.gridSelection.rows.toArray()).toEqual([2])

      // syncSelectionState should NOT be called again since the row
      // selection didn't actually change
      expect(syncSelectionStateMock).toBeCalledTimes(1)
    })

    it("syncs column selection even when row clearing is prevented in combined mode", () => {
      const { result } = renderHook(() =>
        useSelectionHandler(
          DataframeProto.create({
            selectionMode: [
              DataframeProto.SelectionMode.SINGLE_ROW_REQUIRED,
              DataframeProto.SelectionMode.MULTI_COLUMN,
            ],
          }),
          false,
          false,
          [],
          syncSelectionStateMock
        )
      )

      // First, select a row
      const selectionWithRow = {
        columns: CompactSelection.empty(),
        rows: CompactSelection.fromSingleSelection(1),
        current: undefined,
      }

      act(() => {
        result.current.processSelectionChange(selectionWithRow)
      })

      expect(result.current.gridSelection.rows.toArray()).toEqual([1])
      expect(syncSelectionStateMock).toBeCalledTimes(1)

      // Simulate glide-data-grid event when clicking a column header:
      // it tries to clear rows and select the column
      const selectionWithColumnAndNoRows = {
        columns: CompactSelection.fromSingleSelection(2),
        rows: CompactSelection.empty(), // tries to clear rows
        current: undefined,
      }

      act(() => {
        result.current.processSelectionChange(selectionWithColumnAndNoRows)
      })

      // Row selection should be preserved
      expect(result.current.gridSelection.rows.toArray()).toEqual([1])
      // Column selection should be applied
      expect(result.current.gridSelection.columns.toArray()).toEqual([2])

      // syncSelectionState should be called again to sync the column change
      expect(syncSelectionStateMock).toBeCalledTimes(2)
    })
  })
})
