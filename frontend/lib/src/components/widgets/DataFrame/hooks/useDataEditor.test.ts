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

import {
  CompactSelection,
  GridSelection,
  TextCell,
} from "@glideapps/glide-data-grid"
import { renderHook } from "@testing-library/react-hooks"

import {
  BaseColumn,
  NumberColumn,
  TextColumn,
} from "@streamlit/lib/src/components/widgets/DataFrame/columns"
import EditingState from "@streamlit/lib/src/components/widgets/DataFrame/EditingState"
import { notNullOrUndefined } from "@streamlit/lib/src/util/utils"

import useDataEditor from "./useDataEditor"

const MOCK_COLUMNS: BaseColumn[] = [
  NumberColumn({
    id: "column_1",
    name: "column_1",
    title: "column_1",
    indexNumber: 0,
    arrowType: {
      pandas_type: "int64",
      numpy_type: "int64",
    },
    isEditable: true,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  }),
  TextColumn({
    id: "column_2",
    name: "column_2",
    title: "column_2",
    indexNumber: 1,
    arrowType: {
      pandas_type: "unicode",
      numpy_type: "object",
    },
    isEditable: true,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
    defaultValue: "foo",
    columnTypeOptions: {
      max_chars: 10,
      validate: "^[a-zA-Z]+$",
    },
  }),
]

const INITIAL_NUM_ROWS = 3
const refreshCellsMock = jest.fn()
const syncEditsMock = jest.fn()
const updateNumRows = jest.fn()
const clearSelectionMock = jest.fn()
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
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
    expect(syncEditsMock).toHaveBeenCalled()
    expect(getCellContentMock).toHaveBeenCalled()
    const editedCell = editingState.current.getCell(1, 0)

    expect(notNullOrUndefined(editedCell)).toBe(true)

    // @ts-expect-error
    expect(columnToEdit.getCellValue(editedCell)).toEqual("bar")

    // Check with full editing state
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      '{"edited_rows":{"0":{"column_2":"bar"}},"added_rows":[],"deleted_rows":[]}'
    )
  })

  it("correctly handles indices on editing", () => {
    const editingState = {
      current: new EditingState(INITIAL_NUM_ROWS),
    }

    const { result } = renderHook(() => {
      return useDataEditor(
        [{ ...MOCK_COLUMNS[0], isIndex: true }, MOCK_COLUMNS[1]],
        false,
        editingState,
        getCellContentMock,
        getOriginalIndexMock,
        refreshCellsMock,
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
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
    expect(syncEditsMock).toHaveBeenCalled()
    expect(getCellContentMock).toHaveBeenCalled()
    const editedCell = editingState.current.getCell(1, 0)

    expect(notNullOrUndefined(editedCell)).toBe(true)

    // @ts-expect-error
    expect(columnToEdit.getCellValue(editedCell)).toEqual("bar")

    // Check with full editing state
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      '{"edited_rows":{"0":{"column_2":"bar"}},"added_rows":[],"deleted_rows":[]}'
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
      )
    })

    if (typeof result.current.onPaste !== "function") {
      throw new Error("onPaste is expected to be a function")
    }

    // Paste in some data into the second row:
    result.current.onPaste([0, 1], [["321", "bar", "baz"]])

    expect(syncEditsMock).toHaveBeenCalled()
    expect(getCellContentMock).toHaveBeenCalled()

    // Check edited data from first column
    const cell1 = editingState.current.getCell(0, 1)
    expect(notNullOrUndefined(cell1)).toBe(true)

    // @ts-expect-error
    expect(MOCK_COLUMNS[0].getCellValue(cell1)).toEqual(321)

    // Check data from second column
    const cell2 = editingState.current.getCell(1, 1)
    expect(cell2).not.toBeNull()

    // @ts-expect-error
    expect(MOCK_COLUMNS[1].getCellValue(cell2)).toEqual("bar")

    // Check with full editing state
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      '{"edited_rows":{"1":{"column_1":321,"column_2":"bar"}},"added_rows":[],"deleted_rows":[]}'
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
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

    expect(syncEditsMock).toHaveBeenCalled()
    expect(getCellContentMock).toHaveBeenCalled()

    // Check with full editing state:
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      '{"edited_rows":{"2":{"column_1":321,"column_2":"bar"}},"added_rows":[{"column_1":432,"column_2":"lorem"}],"deleted_rows":[]}'
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
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

    expect(syncEditsMock).toHaveBeenCalled()
    expect(getCellContentMock).toHaveBeenCalled()

    // Check with full editing state:
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      '{"edited_rows":{"2":{"column_1":321,"column_2":"bar"}},"added_rows":[],"deleted_rows":[]}'
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
      )
    })

    if (typeof result.current.onRowAppended !== "function") {
      throw new Error("onRowAppended is expected to be a function")
    }

    result.current.onRowAppended()

    // This should have added one row
    expect(editingState.current.getNumRows()).toEqual(INITIAL_NUM_ROWS + 1)

    expect(syncEditsMock).toHaveBeenCalled()
  })

  it("uses default values for new rows in onRowAppended", () => {
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
      )
    })

    if (typeof result.current.onRowAppended !== "function") {
      throw new Error("onRowAppended is expected to be a function")
    }

    result.current.onRowAppended()

    // Check with full editing state:
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      '{"edited_rows":{},"added_rows":[{"column_2":"foo"}],"deleted_rows":[]}'
    )
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
      )
    })

    if (typeof result.current.onRowAppended !== "function") {
      throw new Error("onRowAppended is expected to be a function")
    }

    result.current.onRowAppended()

    // Row addition is deactivated, this should not add any rows
    expect(editingState.current.getNumRows()).toEqual(INITIAL_NUM_ROWS)

    expect(syncEditsMock).toHaveBeenCalledTimes(0)
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
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

    expect(syncEditsMock).toHaveBeenCalled()
    expect(refreshCellsMock).toHaveBeenCalledWith([{ cell: [0, 0] }])

    // The value of cell 0,0 should be null
    const cell1 = editingState.current.getCell(0, 0)

    expect(notNullOrUndefined(cell1)).toBe(true)

    // @ts-expect-error
    expect(MOCK_COLUMNS[0].getCellValue(cell1)).toEqual(null)

    // Check with full editing state
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      '{"edited_rows":{"0":{"column_1":null}},"added_rows":[],"deleted_rows":[]}'
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
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

    expect(syncEditsMock).toHaveBeenCalled()

    // Check with full editing state
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      `{"edited_rows":{},"added_rows":[],"deleted_rows":[1]}`
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
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

    expect(syncEditsMock).toHaveBeenCalledTimes(0)

    // Check with full editing state
    expect(editingState.current.toJson(MOCK_COLUMNS)).toEqual(
      `{"edited_rows":{},"added_rows":[],"deleted_rows":[]}`
    )
  })

  it("calls validateInput and returns false on invalid data.", () => {
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
      )
    })

    if (typeof result.current.validateCell !== "function") {
      throw new Error("validateCell is expected to be a function")
    }

    const columnToValidate = MOCK_COLUMNS[1]
    const invalidValue = columnToValidate.getCell("12345") as TextCell
    const validationResult = result.current.validateCell(
      [1, 0],
      invalidValue,
      columnToValidate.getCell(undefined)
    )

    expect(validationResult).toEqual(false)
  })

  it("calls validateInput and corrects invalid input.", () => {
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
      )
    })

    if (typeof result.current.validateCell !== "function") {
      throw new Error("validateCell is expected to be a function")
    }

    const columnToValidate = MOCK_COLUMNS[1]
    const invalidValue = columnToValidate.getCell("abcdefghijk") as TextCell
    const validationResult = result.current.validateCell(
      [1, 0],
      invalidValue,
      columnToValidate.getCell(undefined)
    )
    expect((validationResult as TextCell).data).toEqual("abcdefghij")
  })

  it("calls validateInput and returns true on valid data.", () => {
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
        updateNumRows,
        syncEditsMock,
        clearSelectionMock
      )
    })

    if (typeof result.current.validateCell !== "function") {
      throw new Error("validateCell is expected to be a function")
    }

    const columnToValidate = MOCK_COLUMNS[1]

    const validValue = columnToValidate.getCell("abcde") as TextCell
    const validResult = result.current.validateCell(
      [1, 0],
      validValue,
      columnToValidate.getCell(undefined)
    )

    expect(validResult).toEqual(true)
  })
})
