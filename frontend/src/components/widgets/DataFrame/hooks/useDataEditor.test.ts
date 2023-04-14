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

import { renderHook } from "@testing-library/react-hooks"
import {
  TextCell,
  GridSelection,
  CompactSelection,
} from "@glideapps/glide-data-grid"

import {
  BaseColumn,
  TextColumn,
  NumberColumn,
} from "src/components/widgets/DataFrame/columns"
import EditingState from "src/components/widgets/DataFrame/EditingState"
import { notNullOrUndefined } from "src/lib/util/utils"

import useDataEditor from "./useDataEditor"

const MOCK_COLUMNS: BaseColumn[] = [
  NumberColumn({
    id: "column_1",
    title: "column_1",
    indexNumber: 0,
    arrowType: {
      pandas_type: "int64",
      numpy_type: "int64",
    },
    isEditable: true,
    isHidden: false,
    isIndex: false,
    isStretched: false,
  }),
  TextColumn({
    id: "column_2",
    title: "column_2",
    indexNumber: 1,
    arrowType: {
      pandas_type: "unicode",
      numpy_type: "object",
    },
    isEditable: true,
    isHidden: false,
    isIndex: false,
    isStretched: false,
  }),
]

const INITIAL_NUM_ROWS = 3
const refreshCellsMock = jest.fn()
const applyEditsMock = jest.fn()
const getOriginalIndexMock = jest.fn().mockImplementation((index: number) => {
  return index
})
const getCellContentMock = jest
  .fn()
  .mockImplementation(([col]: readonly [number]) => {
    const column = MOCK_COLUMNS[col]
    if (column.kind === "number") {
      return column.getCell(123)
    }
    return column.getCell("foo")
  })

describe("useDataEditor hook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  it("allows to edit cells with onCellEdited", () => {
    const editingState = {
      current: new EditingState(INITIAL_NUM_ROWS),
    }

    const { result } = renderHook(() => {
      return useDataEditor(
        MOCK_COLUMNS,
        false,
        editingState,
        getCellContentMock,
        getOriginalIndexMock,
        refreshCellsMock,
        applyEditsMock
      )
    })

    if (typeof result.current.onCellEdited !== "function") {
      throw new Error("onCellEdited is expected to be a function")
    }

    const columnToEdit = MOCK_COLUMNS[1]
    result.current.onCellEdited(
      [1, 0],
      columnToEdit.getCell("bar") as TextCell
    )
    expect(applyEditsMock).toHaveBeenCalled()
    expect(getCellContentMock).toHaveBeenCalled()
    const editedCell = editingState.current.getCell(1, 0)

    expect(notNullOrUndefined(editedCell)).toBe(true)

    if (notNullOrUndefined(editedCell)) {
      expect(columnToEdit.getCellValue(editedCell)).toEqual("bar")
    }

    // Check with full editing state
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      `{"edited_cells":{"0:1":"bar"},"added_rows":[],"deleted_rows":[]}`
    )
  })

  it("applies cell edits from pasted data via onPaste", () => {
    const editingState = {
      current: new EditingState(INITIAL_NUM_ROWS),
    }
    const { result } = renderHook(() => {
      return useDataEditor(
        MOCK_COLUMNS,
        false,
        editingState,
        getCellContentMock,
        getOriginalIndexMock,
        refreshCellsMock,
        applyEditsMock
      )
    })

    if (typeof result.current.onPaste !== "function") {
      throw new Error("onPaste is expected to be a function")
    }

    // Paste in some data into the second row:
    result.current.onPaste([0, 1], [["321", "bar", "baz"]])

    expect(applyEditsMock).toHaveBeenCalled()
    expect(getCellContentMock).toHaveBeenCalled()

    // Check edited data from first column
    const cell1 = editingState.current.getCell(0, 1)
    expect(notNullOrUndefined(cell1)).toBe(true)

    if (notNullOrUndefined(cell1)) {
      expect(MOCK_COLUMNS[0].getCellValue(cell1)).toEqual(321)
    }

    // Check data from second column
    const cell2 = editingState.current.getCell(1, 1)
    expect(cell2).not.toBeNull()
    if (notNullOrUndefined(cell2)) {
      expect(MOCK_COLUMNS[1].getCellValue(cell2)).toEqual("bar")
    }

    // Check with full editing state
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      `{"edited_cells":{"1:0":321,"1:1":"bar"},"added_rows":[],"deleted_rows":[]}`
    )
  })

  it("adds new rows from pasted data via onPaste", () => {
    const editingState = {
      current: new EditingState(INITIAL_NUM_ROWS),
    }
    const { result } = renderHook(() => {
      return useDataEditor(
        MOCK_COLUMNS,
        false, // activates addition & deletion of rows
        editingState,
        getCellContentMock,
        getOriginalIndexMock,
        refreshCellsMock,
        applyEditsMock
      )
    })

    if (typeof result.current.onPaste !== "function") {
      throw new Error("onPaste is expected to be a function")
    }

    // Paste in two rows into the last row
    result.current.onPaste(
      [0, INITIAL_NUM_ROWS - 1],
      [
        ["321", "bar", "baz"],
        ["432", "lorem", "ipsum"],
      ]
    )

    // This should have added one row:
    expect(editingState.current.getNumRows()).toEqual(INITIAL_NUM_ROWS + 1)

    expect(applyEditsMock).toHaveBeenCalled()
    expect(getCellContentMock).toHaveBeenCalled()

    // Check with full editing state:
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      `{"edited_cells":{"2:0":321,"2:1":"bar"},"added_rows":[{"0":432,"1":"lorem"}],"deleted_rows":[]}`
    )
  })

  it("doesn't add new rows from pasted data via onPaste if fixed num rows", () => {
    const editingState = {
      current: new EditingState(INITIAL_NUM_ROWS),
    }
    const { result } = renderHook(() => {
      return useDataEditor(
        MOCK_COLUMNS,
        true, // deactivate the addition of new rows
        editingState,
        getCellContentMock,
        getOriginalIndexMock,
        refreshCellsMock,
        applyEditsMock
      )
    })

    if (typeof result.current.onPaste !== "function") {
      throw new Error("onPaste is expected to be a function")
    }

    // Paste in two rows into the last row
    result.current.onPaste(
      [0, INITIAL_NUM_ROWS - 1],
      [
        ["321", "bar", "baz"],
        ["432", "lorem", "ipsum"],
      ]
    )

    // This should not have added any rows since fixedNumRows is true
    expect(editingState.current.getNumRows()).toEqual(INITIAL_NUM_ROWS)

    expect(applyEditsMock).toHaveBeenCalled()
    expect(getCellContentMock).toHaveBeenCalled()

    // Check with full editing state:
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      `{"edited_cells":{"2:0":321,"2:1":"bar"},"added_rows":[],"deleted_rows":[]}`
    )
  })

  it("allows to add new rows via onRowAppended", () => {
    const editingState = {
      current: new EditingState(INITIAL_NUM_ROWS),
    }
    const { result } = renderHook(() => {
      return useDataEditor(
        MOCK_COLUMNS,
        false, // activates addition & deletion of rows
        editingState,
        getCellContentMock,
        getOriginalIndexMock,
        refreshCellsMock,
        applyEditsMock
      )
    })

    if (typeof result.current.onRowAppended !== "function") {
      throw new Error("onRowAppended is expected to be a function")
    }

    result.current.onRowAppended()

    // This should have added one row
    expect(editingState.current.getNumRows()).toEqual(INITIAL_NUM_ROWS + 1)

    expect(applyEditsMock).toHaveBeenCalledWith(false, false)
  })

  it("doesn't allow to add new rows via onRowAppended if fix num rows", () => {
    const editingState = {
      current: new EditingState(INITIAL_NUM_ROWS),
    }
    const { result } = renderHook(() => {
      return useDataEditor(
        MOCK_COLUMNS,
        true, // deactivates addition & deletion of rows
        editingState,
        getCellContentMock,
        getOriginalIndexMock,
        refreshCellsMock,
        applyEditsMock
      )
    })

    if (typeof result.current.onRowAppended !== "function") {
      throw new Error("onRowAppended is expected to be a function")
    }

    result.current.onRowAppended()

    // Row addition is deactivated, this should not add any rows
    expect(editingState.current.getNumRows()).toEqual(INITIAL_NUM_ROWS)

    expect(applyEditsMock).toHaveBeenCalledTimes(0)
  })

  it("allows to delete cell content via onDelete", () => {
    const editingState = {
      current: new EditingState(INITIAL_NUM_ROWS),
    }
    const { result } = renderHook(() => {
      return useDataEditor(
        MOCK_COLUMNS,
        false,
        editingState,
        getCellContentMock,
        getOriginalIndexMock,
        refreshCellsMock,
        applyEditsMock
      )
    })

    if (typeof result.current.onDelete !== "function") {
      throw new Error("onDelete is expected to be a function")
    }

    // Mock selection to delete cell 0,0
    const deleteCellSelection = {
      current: {
        range: { x: 0, y: 0, width: 1, height: 1 },
      },
      rows: CompactSelection.empty(),
      columns: CompactSelection.empty(),
    } as GridSelection

    // Delete the cell content for 0,0 -> changes the value to null
    result.current.onDelete(deleteCellSelection)

    expect(applyEditsMock).toHaveBeenCalled()
    expect(refreshCellsMock).toHaveBeenCalledWith([{ cell: [0, 0] }])

    // The value of cell 0,0 should be null
    const cell1 = editingState.current.getCell(0, 0)

    expect(notNullOrUndefined(cell1)).toBe(true)

    if (notNullOrUndefined(cell1)) {
      expect(MOCK_COLUMNS[0].getCellValue(cell1)).toEqual(null)
    }

    // Check with full editing state
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      `{"edited_cells":{"0:0":null},"added_rows":[],"deleted_rows":[]}`
    )
  })

  it("allows to delete rows via onDelete", () => {
    const editingState = {
      current: new EditingState(INITIAL_NUM_ROWS),
    }
    const { result } = renderHook(() => {
      return useDataEditor(
        MOCK_COLUMNS,
        false, // activates addition & deletion of rows
        editingState,
        getCellContentMock,
        getOriginalIndexMock,
        refreshCellsMock,
        applyEditsMock
      )
    })

    if (typeof result.current.onDelete !== "function") {
      throw new Error("onDelete is expected to be a function")
    }

    // Mock selection to delete row 1
    const deleteRowSelection = {
      current: undefined,
      rows: CompactSelection.fromSingleSelection(1),
      columns: CompactSelection.empty(),
    } as GridSelection

    // Delete the row
    result.current.onDelete(deleteRowSelection)

    // The number of rows should be one less
    expect(editingState.current.getNumRows()).toEqual(INITIAL_NUM_ROWS - 1)

    expect(applyEditsMock).toHaveBeenCalledWith(true)

    // Check with full editing state
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      `{"edited_cells":{},"added_rows":[],"deleted_rows":[1]}`
    )
  })

  it("doesn't allow to delete rows via onDelete if fix num rows", () => {
    const editingState = {
      current: new EditingState(INITIAL_NUM_ROWS),
    }
    const { result } = renderHook(() => {
      return useDataEditor(
        MOCK_COLUMNS,
        true, // deactivates addition & deletion of rows
        editingState,
        getCellContentMock,
        getOriginalIndexMock,
        refreshCellsMock,
        applyEditsMock
      )
    })

    if (typeof result.current.onDelete !== "function") {
      throw new Error("onDelete is expected to be a function")
    }

    // Mock selection to delete row 1
    const deleteRowSelection = {
      current: undefined,
      rows: CompactSelection.fromSingleSelection(1),
      columns: CompactSelection.empty(),
    } as GridSelection

    // Delete the row
    result.current.onDelete(deleteRowSelection)

    // The number of rows should be same since row deletion is not allowed:
    expect(editingState.current.getNumRows()).toEqual(INITIAL_NUM_ROWS)

    expect(applyEditsMock).toHaveBeenCalledTimes(0)

    // Check with full editing state
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      `{"edited_cells":{},"added_rows":[],"deleted_rows":[]}`
    )
  })
})
