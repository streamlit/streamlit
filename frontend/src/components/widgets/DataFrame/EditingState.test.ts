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

import { GridCell, TextCell, GridCellKind } from "@glideapps/glide-data-grid"

import {
  BaseColumnProps,
  TextColumn,
} from "src/components/widgets/DataFrame/columns"

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
      title: "column_1",
      indexNumber: 0,
      arrowType: {
        pandas_type: "unicode",
        numpy_type: "object",
      },
      isEditable: false,
      isHidden: false,
      isIndex: false,
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

    expect(json).toEqual(
      `{"edited_cells":{"0:0":"foo"},"added_rows":[{"0":"foo","1":"foo"}],"deleted_rows":[1]}`
    )
  })

  it.each([
    [
      `{"edited_cells":{"0:0":"foo"},"added_rows":[{"0":"foo","1":"foo"}],"deleted_rows":[1]}`,
    ],
    [`{"edited_cells":{},"added_rows":[],"deleted_rows":[]}`],
    [
      `{"edited_cells":{},"added_rows":[{"0":"foo","1":"foo"}],"deleted_rows":[]}`,
    ],
    [`{"edited_cells":{},"added_rows":[],"deleted_rows":[1]}`],
    [`{"edited_cells":{"0:0":"foo"},"added_rows":[],"deleted_rows":[]}`],
  ])("converts JSON to editing state: %p", (editingStateJson: string) => {
    const NUM_OF_ROWS = 3
    const editingState = new EditingState(NUM_OF_ROWS)

    const MOCK_COLUMN_PROPS = {
      id: "column_1",
      title: "column_1",
      indexNumber: 0,
      arrowType: {
        pandas_type: "unicode",
        numpy_type: "object",
      },
      isEditable: false,
      isHidden: false,
      isIndex: false,
      isStretched: false,
    } as BaseColumnProps

    const MOCK_COLUMNS = [
      TextColumn({
        ...MOCK_COLUMN_PROPS,
        indexNumber: 0,
        id: "column_1",
      }),
      TextColumn({
        ...MOCK_COLUMN_PROPS,
        indexNumber: 1,
        id: "column_2",
      }),
    ]
    editingState.fromJson(editingStateJson, MOCK_COLUMNS)
    // Test again if the edits were applied correctly:
    expect(editingState.toJson(MOCK_COLUMNS)).toEqual(editingStateJson)
  })
})
