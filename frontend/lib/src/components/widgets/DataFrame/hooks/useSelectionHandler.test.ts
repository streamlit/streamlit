/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { act, renderHook } from "@testing-library/react-hooks"
import { CompactSelection } from "@glideapps/glide-data-grid"

import { Arrow as ArrowProto } from "@streamlit/lib/src/proto"
import { TextColumn } from "@streamlit/lib/src/components/widgets/DataFrame/columns"

import useSelectionHandler from "./useSelectionHandler"

const syncSelectionStateMock = jest.fn()

describe("useSelectionHandler hook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("detects single row selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [ArrowProto.SelectionMode.SINGLE_ROW],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    expect(result.current.isRowSelectionActivated).toEqual(true)
    expect(result.current.isMultiRowSelectionActivated).toEqual(false)

    expect(result.current.isColumnSelectionActivated).toEqual(false)
    expect(result.current.isMultiColumnSelectionActivated).toEqual(false)

    expect(result.current.isCellSelectionActivated).toEqual(false)
    expect(result.current.isMultiCellSelectionActivated).toEqual(false)
  })

  it("detects multi row selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [ArrowProto.SelectionMode.MULTI_ROW],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    expect(result.current.isRowSelectionActivated).toEqual(true)
    expect(result.current.isMultiRowSelectionActivated).toEqual(true)

    expect(result.current.isColumnSelectionActivated).toEqual(false)
    expect(result.current.isMultiColumnSelectionActivated).toEqual(false)

    expect(result.current.isCellSelectionActivated).toEqual(false)
    expect(result.current.isMultiCellSelectionActivated).toEqual(false)
  })

  it("detects single column selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [ArrowProto.SelectionMode.SINGLE_COLUMN],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    expect(result.current.isRowSelectionActivated).toEqual(false)
    expect(result.current.isMultiRowSelectionActivated).toEqual(false)

    expect(result.current.isColumnSelectionActivated).toEqual(true)
    expect(result.current.isMultiColumnSelectionActivated).toEqual(false)

    expect(result.current.isCellSelectionActivated).toEqual(false)
    expect(result.current.isMultiCellSelectionActivated).toEqual(false)
  })
  it("detects multi column selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [ArrowProto.SelectionMode.MULTI_COLUMN],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    expect(result.current.isRowSelectionActivated).toEqual(false)
    expect(result.current.isMultiRowSelectionActivated).toEqual(false)

    expect(result.current.isColumnSelectionActivated).toEqual(true)
    expect(result.current.isMultiColumnSelectionActivated).toEqual(true)

    expect(result.current.isCellSelectionActivated).toEqual(false)
    expect(result.current.isMultiCellSelectionActivated).toEqual(false)
  })
  it("detects single cell selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [ArrowProto.SelectionMode.SINGLE_CELL],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    expect(result.current.isRowSelectionActivated).toEqual(false)
    expect(result.current.isMultiRowSelectionActivated).toEqual(false)

    expect(result.current.isColumnSelectionActivated).toEqual(false)
    expect(result.current.isMultiColumnSelectionActivated).toEqual(false)

    expect(result.current.isCellSelectionActivated).toEqual(true)
    expect(result.current.isMultiCellSelectionActivated).toEqual(false)
  })
  it("detects multi cell selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [ArrowProto.SelectionMode.MULTI_CELL],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    expect(result.current.isRowSelectionActivated).toEqual(false)
    expect(result.current.isMultiRowSelectionActivated).toEqual(false)

    expect(result.current.isColumnSelectionActivated).toEqual(false)
    expect(result.current.isMultiColumnSelectionActivated).toEqual(false)

    expect(result.current.isCellSelectionActivated).toEqual(true)
    expect(result.current.isMultiCellSelectionActivated).toEqual(true)
  })
  it("detects mixed multi selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [
            ArrowProto.SelectionMode.MULTI_ROW,
            ArrowProto.SelectionMode.MULTI_COLUMN,
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
  })
  it("disables all selections if empty table", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [
            ArrowProto.SelectionMode.MULTI_ROW,
            ArrowProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        true,
        false,
        [],
        syncSelectionStateMock
      )
    )

    expect(result.current.isRowSelectionActivated).toEqual(false)
    expect(result.current.isMultiRowSelectionActivated).toEqual(false)

    expect(result.current.isColumnSelectionActivated).toEqual(false)
    expect(result.current.isMultiColumnSelectionActivated).toEqual(false)
  })
  it("correctly processes and clears column selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [
            ArrowProto.SelectionMode.MULTI_ROW,
            ArrowProto.SelectionMode.MULTI_COLUMN,
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
        ArrowProto.create({
          selectionMode: [
            ArrowProto.SelectionMode.MULTI_ROW,
            ArrowProto.SelectionMode.MULTI_COLUMN,
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
        ArrowProto.create({
          selectionMode: [
            ArrowProto.SelectionMode.MULTI_ROW,
            ArrowProto.SelectionMode.MULTI_COLUMN,
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

  it("correctly processes and clears cell selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [
            ArrowProto.SelectionMode.MULTI_ROW,
            ArrowProto.SelectionMode.MULTI_COLUMN,
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
  it("keeps row & column selection on cell selection changes", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [
            ArrowProto.SelectionMode.MULTI_ROW,
            ArrowProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    // Select a row+column:
    const firstGridSelection = {
      columns: CompactSelection.fromSingleSelection(0),
      rows: CompactSelection.fromSingleSelection(0),
      cell: undefined,
    }
    act(() => {
      const { processSelectionChange } = result.current
      processSelectionChange?.(firstGridSelection)
    })

    // Check that it detects a row+column to be selected:
    expect(result.current.isCellSelected).toEqual(false)
    expect(result.current.isRowSelected).toEqual(true)
    expect(result.current.isColumnSelected).toEqual(true)

    expect(syncSelectionStateMock).toBeCalledTimes(1)

    const secondGridSelection = {
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
      current: {
        cell: [0, 0],
      },
    }
    // Select a cell:
    act(() => {
      const { processSelectionChange } = result.current
      // @ts-expect-error
      processSelectionChange?.(secondGridSelection)
    })

    // Row+column selection should be kept:
    expect(result.current.isCellSelected).toEqual(true)
    expect(result.current.isRowSelected).toEqual(true)
    expect(result.current.isColumnSelected).toEqual(true)

    // This should not call syncSelectionState callback:
    expect(syncSelectionStateMock).toBeCalledTimes(1)
  })
  it("keeps row selection on column selection changes", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [
            ArrowProto.SelectionMode.MULTI_ROW,
            ArrowProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    // Select only a row:
    const firstGridSelection = {
      columns: CompactSelection.empty(),
      rows: CompactSelection.fromSingleSelection(0),
      cell: undefined,
    }
    act(() => {
      const { processSelectionChange } = result.current
      processSelectionChange?.(firstGridSelection)
    })

    // Only a row should be selected:
    expect(result.current.isCellSelected).toEqual(false)
    expect(result.current.isRowSelected).toEqual(true)
    expect(result.current.isColumnSelected).toEqual(false)

    expect(syncSelectionStateMock).toBeCalledTimes(1)

    const secondGridSelection = {
      columns: CompactSelection.fromSingleSelection(0),
      rows: CompactSelection.empty(),
      cell: undefined,
    }
    // Select a column
    act(() => {
      const { processSelectionChange } = result.current
      processSelectionChange?.(secondGridSelection)
    })

    // Row selection is kept in addition to the new column selection:
    expect(result.current.isRowSelected).toEqual(true)
    expect(result.current.isColumnSelected).toEqual(true)
    expect(result.current.isCellSelected).toEqual(false)

    expect(syncSelectionStateMock).toBeCalledTimes(2)
  })
  it("keeps column selection on row selection changes", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [
            ArrowProto.SelectionMode.MULTI_ROW,
            ArrowProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        false,
        false,
        [],
        syncSelectionStateMock
      )
    )

    // Select only a column:
    const firstGridSelection = {
      columns: CompactSelection.fromSingleSelection(0),
      rows: CompactSelection.empty(),
      cell: undefined,
    }
    act(() => {
      const { processSelectionChange } = result.current
      processSelectionChange?.(firstGridSelection)
    })

    // Only a column should be selected:
    expect(result.current.isCellSelected).toEqual(false)
    expect(result.current.isRowSelected).toEqual(false)
    expect(result.current.isColumnSelected).toEqual(true)
    expect(syncSelectionStateMock).toBeCalledTimes(1)

    // Select a row:
    const secondGridSelection = {
      columns: CompactSelection.empty(),
      rows: CompactSelection.fromSingleSelection(0),
      cell: undefined,
    }
    act(() => {
      const { processSelectionChange } = result.current
      processSelectionChange?.(secondGridSelection)
    })

    // Column selection is kept in addition to the new row selection:
    expect(result.current.isRowSelected).toEqual(true)
    expect(result.current.isColumnSelected).toEqual(true)
    expect(result.current.isCellSelected).toEqual(false)
    expect(syncSelectionStateMock).toBeCalledTimes(2)
  })

  it("ignores index column selection", () => {
    const { result } = renderHook(() =>
      useSelectionHandler(
        ArrowProto.create({
          selectionMode: [
            ArrowProto.SelectionMode.MULTI_ROW,
            ArrowProto.SelectionMode.MULTI_COLUMN,
          ],
        }),
        false,
        false,
        [
          // Configure 1 index column
          TextColumn({
            arrowType: {
              meta: null,
              numpy_type: "object",
              pandas_type: "unicode",
            },
            id: "index-0",
            name: "",
            indexNumber: 0,
            isEditable: true,
            isHidden: false,
            isIndex: true,
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
})
