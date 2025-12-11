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

import { GridCell, GridCellKind, TextCell } from "@glideapps/glide-data-grid"
import { Field, Utf8 } from "apache-arrow"

import {
  BaseColumnProps,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import EditingState from "./EditingState"

const MOCK_TEXT_CELL_1: TextCell = {
  kind: GridCellKind.Text,
  displayData: "foo",
  data: "foo",
  allowOverlay: true,
}

const MOCK_TEXT_CELL_2: TextCell = {
  kind: GridCellKind.Text,
  displayData: "foo",
  data: "foo",
  allowOverlay: true,
}

const MOCK_TEXT_MISSING_CELL = {
  kind: GridCellKind.Text,
  displayData: "",
  data: "",
  isMissingValue: true,
  allowOverlay: true,
} as TextCell

describe("EditingState class", () => {
  it("allows to set edited cells", () => {
    const NUM_OF_ROWS = 3
    const editingState = new EditingState(NUM_OF_ROWS)
    editingState.setCell(0, 0, MOCK_TEXT_CELL_1)
    expect(editingState.getCell(0, 0)).toEqual(MOCK_TEXT_CELL_1)
    expect(editingState.getCell(1, 1)).toEqual(undefined)

    // Overwrite cell
    editingState.setCell(0, 0, MOCK_TEXT_CELL_2)
    expect(editingState.getCell(0, 0)).toEqual(MOCK_TEXT_CELL_2)
  })

  it("allows to add rows", () => {
    const NUM_OF_ROWS = 3
    const editingState = new EditingState(NUM_OF_ROWS)

    const rowCells: Map<number, GridCell> = new Map()
    rowCells.set(0, MOCK_TEXT_CELL_1)
    rowCells.set(1, MOCK_TEXT_CELL_2)

    // Add a row and check values
    editingState.addRow(rowCells)
    expect(editingState.getNumRows()).toEqual(NUM_OF_ROWS + 1)
    expect(editingState.isAddedRow(2)).toEqual(false)
    expect(editingState.isAddedRow(3)).toEqual(true)
    expect(editingState.getCell(0, 3)).toEqual(MOCK_TEXT_CELL_1)
    expect(editingState.getCell(1, 3)).toEqual(MOCK_TEXT_CELL_2)

    // Add another row
    editingState.addRow(rowCells)
    expect(editingState.getNumRows()).toEqual(NUM_OF_ROWS + 2)
    expect(editingState.getCell(0, 4)).toEqual(MOCK_TEXT_CELL_1)
    expect(editingState.getCell(1, 4)).toEqual(MOCK_TEXT_CELL_2)
  })

  it("allows to delete a single row", () => {
    const NUM_OF_ROWS = 3
    const editingState = new EditingState(NUM_OF_ROWS)

    // Delete first row
    editingState.deleteRow(0)
    expect(editingState.getNumRows()).toEqual(NUM_OF_ROWS - 1)

    // The current row 0 should be the original row 1
    expect(editingState.getOriginalRowIndex(0)).toEqual(1)
  })

  it("allows to add and delete multiple rows", () => {
    const NUM_OF_ROWS = 3
    const editingState = new EditingState(NUM_OF_ROWS)

    const rowCells: Map<number, GridCell> = new Map()
    rowCells.set(0, MOCK_TEXT_CELL_1)
    rowCells.set(1, MOCK_TEXT_CELL_2)

    // Add two rows
    editingState.addRow(rowCells)
    editingState.addRow(rowCells)
    // Should have 5 rows
    expect(editingState.getNumRows()).toEqual(NUM_OF_ROWS + 2)

    // Delete one row
    editingState.deleteRow(3)
    // Should have 4 rows
    expect(editingState.getNumRows()).toEqual(NUM_OF_ROWS + 1)
    // Last row should be an edited row
    let LAST_ROW_ID = editingState.getOriginalRowIndex(
      editingState.getNumRows() - 1
    )
    expect(editingState.isAddedRow(LAST_ROW_ID)).toEqual(true)
    expect(editingState.getCell(0, LAST_ROW_ID)).toEqual(MOCK_TEXT_CELL_1)
    expect(editingState.getCell(1, LAST_ROW_ID)).toEqual(MOCK_TEXT_CELL_2)

    // Delete a row from existing data
    editingState.deleteRow(0)
    // Should have 3 rows
    expect(editingState.getNumRows()).toEqual(NUM_OF_ROWS)

    // Last row should be an edited row
    LAST_ROW_ID = editingState.getOriginalRowIndex(
      editingState.getNumRows() - 1
    )
    expect(editingState.isAddedRow(LAST_ROW_ID)).toEqual(true)
    expect(editingState.getCell(0, LAST_ROW_ID)).toEqual(MOCK_TEXT_CELL_1)
    expect(editingState.getCell(1, LAST_ROW_ID)).toEqual(MOCK_TEXT_CELL_2)

    // Delete remaining rows via deleteRows
    editingState.deleteRows([
      editingState.getOriginalRowIndex(0),
      editingState.getOriginalRowIndex(1),
      editingState.getOriginalRowIndex(2),
    ])
    expect(editingState.getNumRows()).toEqual(0)
  })

  it("ignores rows with required empty values in toJson", () => {
    const NUM_OF_ROWS = 3
    const editingState = new EditingState(NUM_OF_ROWS)

    const rowCells: Map<number, GridCell> = new Map()
    rowCells.set(0, MOCK_TEXT_CELL_1)
    rowCells.set(1, MOCK_TEXT_MISSING_CELL)

    // Add a row and check values
    editingState.addRow(rowCells)
    expect(editingState.getNumRows()).toEqual(NUM_OF_ROWS + 1)

    const baseColumnProps = {
      id: "column_1",
      title: "column_1",
      indexNumber: 0,
      arrowType: {
        type: DataFrameCellType.DATA,
        arrowField: new Field("column_1", new Utf8(), true),
        pandasType: {
          field_name: "column_1",
          name: "column_1",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      isEditable: true,
      isRequired: true,
      isHidden: false,
      isIndex: false,
      isPinned: false,
      isStretched: false,
    } as BaseColumnProps

    // Convert to JSON
    const json = editingState.toJson([
      TextColumn({
        ...baseColumnProps,
        indexNumber: 0,
        id: "column_1",
      }),
      TextColumn({
        ...baseColumnProps,
        indexNumber: 1,
        id: "column_2",
      }),
    ])

    // Row should npt be included in the JSON:
    expect(json).toEqual(
      '{"edited_rows":{},"added_rows":[],"deleted_rows":[]}'
    )
  })

  it("converts editing state to JSON", () => {
    const NUM_OF_ROWS = 3
    const editingState = new EditingState(NUM_OF_ROWS)

    // Edit a cell
    editingState.setCell(0, 0, MOCK_TEXT_CELL_1)

    // Add row
    const rowCells: Map<number, GridCell> = new Map()
    rowCells.set(0, MOCK_TEXT_CELL_1)
    rowCells.set(1, MOCK_TEXT_CELL_2)
    editingState.addRow(rowCells)

    // Delete a row
    editingState.deleteRow(1)

    const baseColumnProps = {
      id: "column_1",
      name: "column_1",
      title: "column_1",
      indexNumber: 0,
      arrowType: {
        type: DataFrameCellType.DATA,
        arrowField: new Field("column_1", new Utf8(), true),
        pandasType: {
          field_name: "column_1",
          name: "column_1",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      isEditable: false,
      isHidden: false,
      isIndex: false,
      isPinned: false,
      isStretched: false,
    } as BaseColumnProps

    // Convert to JSON
    const json = editingState.toJson([
      TextColumn({
        ...baseColumnProps,
        indexNumber: 0,
        id: "column_1",
        name: "column_1",
      }),
      TextColumn({
        ...baseColumnProps,
        indexNumber: 1,
        id: "column_2",
        name: "column_2",
      }),
    ])

    expect(json).toEqual(
      '{"edited_rows":{"0":{"column_1":"foo"}},"added_rows":[{"column_1":"foo","column_2":"foo"}],"deleted_rows":[1]}'
    )
  })

  it.each([
    [
      `{"edited_rows":{"0":{"column_1":"foo"}},"added_rows":[{"column_1":"foo","column_2":"foo"}],"deleted_rows":[1]}`,
    ],
    [`{"edited_rows":{},"added_rows":[],"deleted_rows":[]}`],
    [
      `{"edited_rows":{},"added_rows":[{"column_1":"foo","column_2":"foo"}],"deleted_rows":[]}`,
    ],
    [`{"edited_rows":{},"added_rows":[],"deleted_rows":[1]}`],
    [
      `{"edited_rows":{"0":{"column_1":"foo"}},"added_rows":[],"deleted_rows":[]}`,
    ],
    [
      `{"edited_rows":{"0":{"_index":"foo"}},"added_rows":[],"deleted_rows":[]}`,
    ],
  ])("converts JSON to editing state: %p", (editingStateJson: string) => {
    const NUM_OF_ROWS = 3
    const editingState = new EditingState(NUM_OF_ROWS)

    const MOCK_COLUMN_PROPS = {
      id: "column_1",
      name: "column_1",
      title: "column_1",
      indexNumber: 0,
      arrowType: {
        type: DataFrameCellType.DATA,
        arrowField: new Field("column_1", new Utf8(), true),
        pandasType: {
          field_name: "column_1",
          name: "column_1",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      isEditable: false,
      isRequired: false,
      isHidden: false,
      isIndex: false,
      isPinned: false,
      isStretched: false,
    } as BaseColumnProps

    const MOCK_COLUMNS = [
      TextColumn({
        ...MOCK_COLUMN_PROPS,
        isIndex: true,
        indexNumber: 0,
        id: "index_col",
        name: "index_col",
      }),
      TextColumn({
        ...MOCK_COLUMN_PROPS,
        indexNumber: 1,
        id: "column_1",
        name: "column_1",
      }),
      TextColumn({
        ...MOCK_COLUMN_PROPS,
        indexNumber: 2,
        id: "column_2",
        name: "column_2",
      }),
    ]
    editingState.fromJson(editingStateJson, MOCK_COLUMNS)
    // Test again if the edits were applied correctly:
    expect(editingState.toJson(MOCK_COLUMNS)).toEqual(editingStateJson)
  })

  it("ensure all cells of added rows are filled even if empty", () => {
    const NUM_OF_ROWS = 3
    const editingState = new EditingState(NUM_OF_ROWS)

    const MOCK_COLUMN_PROPS = {
      id: "column_1",
      name: "column_1",
      title: "column_1",
      indexNumber: 0,
      arrowType: {
        type: DataFrameCellType.DATA,
        arrowField: new Field("column_1", new Utf8(), true),
        pandasType: {
          field_name: "column_1",
          name: "column_1",
          pandas_type: "unicode",
          numpy_type: "object",
          metadata: null,
        },
      },
      isEditable: false,
      isRequired: false,
      isHidden: false,
      isIndex: false,
      isPinned: false,
      isStretched: false,
    } as BaseColumnProps

    const MOCK_COLUMNS = [
      TextColumn({
        ...MOCK_COLUMN_PROPS,
        isIndex: true,
        indexNumber: 0,
        id: "index_col",
        name: "index_col",
      }),
      TextColumn({
        ...MOCK_COLUMN_PROPS,
        indexNumber: 1,
        id: "column_1",
        name: "column_1",
      }),
      TextColumn({
        ...MOCK_COLUMN_PROPS,
        indexNumber: 2,
        id: "column_2",
        name: "column_2",
      }),
    ]
    editingState.fromJson(
      `{"edited_rows":{},"added_rows":[{"column_1":"foo"}],"deleted_rows":[]}`,
      MOCK_COLUMNS
    )
    // Should have the value from the JSON:
    expect(editingState.getCell(1, 3)).toEqual(MOCK_COLUMNS[1].getCell("foo"))
    // Should have an empty cell since it wasn't specified in the JSON:
    expect(editingState.getCell(2, 3)).toEqual(MOCK_COLUMNS[2].getCell(null))
  })

  describe("Phase 2: Reconciliation methods", () => {
    it("returns original num rows via getOriginalNumRows", () => {
      const editingState = new EditingState(5)
      expect(editingState.getOriginalNumRows()).toBe(5)

      // Even after adding/deleting rows, original count stays the same
      editingState.addRow(new Map())
      editingState.deleteRow(0)
      expect(editingState.getOriginalNumRows()).toBe(5)
    })

    it("returns deleted rows via getDeletedRows", () => {
      const editingState = new EditingState(5)
      expect(editingState.getDeletedRows()).toEqual([])

      editingState.deleteRow(1)
      editingState.deleteRow(3)
      expect(editingState.getDeletedRows()).toEqual([1, 3])
    })

    it("returns added rows count via getAddedRowsCount", () => {
      const editingState = new EditingState(5)
      expect(editingState.getAddedRowsCount()).toBe(0)

      editingState.addRow(new Map())
      editingState.addRow(new Map())
      expect(editingState.getAddedRowsCount()).toBe(2)
    })

    describe("canReconcileRowChanges", () => {
      it("returns true when new row count matches expected from user edits", () => {
        const editingState = new EditingState(5)

        // Delete one row: expected = 5 - 1 + 0 = 4
        editingState.deleteRow(2)
        expect(editingState.canReconcileRowChanges(4)).toBe(true)
        expect(editingState.canReconcileRowChanges(5)).toBe(false)
        expect(editingState.canReconcileRowChanges(3)).toBe(false)
      })

      it("returns true when rows added match expected", () => {
        const editingState = new EditingState(5)

        // Add two rows: expected = 5 - 0 + 2 = 7
        editingState.addRow(new Map())
        editingState.addRow(new Map())
        expect(editingState.canReconcileRowChanges(7)).toBe(true)
        expect(editingState.canReconcileRowChanges(5)).toBe(false)
      })

      it("returns true when both additions and deletions match expected", () => {
        const editingState = new EditingState(5)

        // Delete 2, add 1: expected = 5 - 2 + 1 = 4
        editingState.deleteRow(1)
        editingState.deleteRow(3)
        editingState.addRow(new Map())
        expect(editingState.canReconcileRowChanges(4)).toBe(true)
      })

      it("returns false when external row change detected", () => {
        const editingState = new EditingState(5)

        // No user changes, but row count changed externally
        expect(editingState.canReconcileRowChanges(6)).toBe(false) // External add
        expect(editingState.canReconcileRowChanges(4)).toBe(false) // External delete
      })
    })

    describe("reconcileAfterUserChanges", () => {
      it("preserves cell edits for non-deleted rows", () => {
        const editingState = new EditingState(5)

        // Edit row 0 and row 4
        editingState.setCell(0, 0, MOCK_TEXT_CELL_1)
        editingState.setCell(0, 4, MOCK_TEXT_CELL_2)

        // Delete rows 1, 2, 3 via user actions
        editingState.deleteRow(1)
        editingState.deleteRow(2)
        editingState.deleteRow(3)

        // New row count = 5 - 3 = 2
        const newState = editingState.reconcileAfterUserChanges(2)

        expect(newState.getNumRows()).toBe(2)
        // Row 0 edit should be at index 0
        expect(newState.getCell(0, 0)).toEqual(MOCK_TEXT_CELL_1)
        // Row 4 edit should shift to index 1 (4 - 3 deletions below = 1)
        expect(newState.getCell(0, 1)).toEqual(MOCK_TEXT_CELL_2)
      })

      it("removes edits for deleted rows", () => {
        const editingState = new EditingState(5)

        // Edit rows 1 and 3
        editingState.setCell(0, 1, MOCK_TEXT_CELL_1)
        editingState.setCell(0, 3, MOCK_TEXT_CELL_2)

        // Delete row 1 (one of the edited rows)
        editingState.deleteRow(1)

        // New row count = 5 - 1 = 4
        const newState = editingState.reconcileAfterUserChanges(4)

        expect(newState.getNumRows()).toBe(4)
        // Original row 0 is still at index 0 (no change)
        // Original row 1 was deleted
        // Original row 2 shifts to index 1
        // Original row 3's edit shifts to index 2 (row 3 - 1 deleted row below = index 2)
        expect(newState.getCell(0, 2)).toEqual(MOCK_TEXT_CELL_2)
        // Original row 4 shifts to index 3
        // Edit to row 1 is gone
        expect(newState.getCell(0, 0)).toBeUndefined() // Row 0 had no edit
        expect(newState.getCell(0, 1)).toBeUndefined() // Row 2 (shifted to 1) had no edit
      })

      it("shifts indices correctly for multiple deletions", () => {
        const editingState = new EditingState(10)

        // Edit row 5
        editingState.setCell(0, 5, MOCK_TEXT_CELL_1)

        // Delete rows 0, 2, 4 (3 rows below row 5)
        editingState.deleteRow(0)
        editingState.deleteRow(2)
        editingState.deleteRow(4)

        // New row count = 10 - 3 = 7
        const newState = editingState.reconcileAfterUserChanges(7)

        // Row 5's new index = 5 - 3 (deleted rows below) = 2
        expect(newState.getCell(0, 2)).toEqual(MOCK_TEXT_CELL_1)
      })

      it("clears addedRows and deletedRows after reconciliation", () => {
        const editingState = new EditingState(5)

        editingState.addRow(new Map())
        editingState.deleteRow(1)

        // New row count = 5 - 1 + 1 = 5
        const newState = editingState.reconcileAfterUserChanges(5)

        // After reconciliation, addedRows and deletedRows should be cleared
        expect(newState.getDeletedRows()).toEqual([])
        expect(newState.getAddedRowsCount()).toBe(0)
      })

      it("handles row addition reconciliation", () => {
        const editingState = new EditingState(3)

        // Edit existing row
        editingState.setCell(0, 1, MOCK_TEXT_CELL_1)

        // Add a row via UI
        editingState.addRow(new Map([[0, MOCK_TEXT_CELL_2]]))

        // New row count = 3 + 1 = 4
        const newState = editingState.reconcileAfterUserChanges(4)

        // Original edit should be preserved at same index
        expect(newState.getCell(0, 1)).toEqual(MOCK_TEXT_CELL_1)
        // Added row is now part of source data, so addedRows should be empty
        expect(newState.getAddedRowsCount()).toBe(0)
      })
    })
  })
})
