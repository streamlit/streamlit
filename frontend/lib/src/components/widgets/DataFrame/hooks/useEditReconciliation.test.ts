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

import { renderHook } from "@testing-library/react"
import { Field, Utf8 } from "apache-arrow"

import {
  BaseColumn,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { Quiver } from "~lib/dataframes/Quiver"

import EditingState from "./EditingState"
import useEditReconciliation from "./useEditReconciliation"

const MOCK_COLUMN = TextColumn({
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
  isEditable: true,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
})

const MOCK_COLUMNS: BaseColumn[] = [MOCK_COLUMN]

function createMockData(sourceValue: string): Quiver {
  return {
    dimensions: {
      numHeaderRows: 1,
      numIndexColumns: 0,
      numDataRows: 1,
      numDataColumns: 1,
      numRows: 2,
      numColumns: 1,
    },
    getCell: vi.fn(() => ({
      type: DataFrameCellType.DATA,
      content: sourceValue,
      contentType: MOCK_COLUMN.arrowType,
      field: MOCK_COLUMN.arrowType.arrowField,
    })),
  } as unknown as Quiver
}

describe("useEditReconciliation hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("clears edits that match updated source data", () => {
    const editingState = {
      current: new EditingState(1),
    }
    editingState.current.setCell(0, 0, MOCK_COLUMN.getCell("bar"))
    const syncEditState = vi.fn()

    const { rerender } = renderHook(
      ({ data }) =>
        useEditReconciliation({
          data,
          allColumns: MOCK_COLUMNS,
          editingState,
          isEditingEnabled: true,
          syncEditState,
        }),
      { initialProps: { data: createMockData("foo") } }
    )

    rerender({ data: createMockData("bar") })

    expect(editingState.current.getCell(0, 0)).toBeUndefined()
    expect(syncEditState).toHaveBeenCalled()
  })

  it("preserves edits that do not match updated source data", () => {
    const editingState = {
      current: new EditingState(1),
    }
    const editedCell = MOCK_COLUMN.getCell("bar")
    editingState.current.setCell(0, 0, editedCell)
    const syncEditState = vi.fn()

    const { rerender } = renderHook(
      ({ data }) =>
        useEditReconciliation({
          data,
          allColumns: MOCK_COLUMNS,
          editingState,
          isEditingEnabled: true,
          syncEditState,
        }),
      { initialProps: { data: createMockData("foo") } }
    )

    rerender({ data: createMockData("baz") })

    expect(editingState.current.getCell(0, 0)).toEqual(editedCell)
    expect(syncEditState).not.toHaveBeenCalled()
  })

  it("does not reconcile on the first render", () => {
    const editingState = {
      current: new EditingState(1),
    }
    const editedCell = MOCK_COLUMN.getCell("foo")
    editingState.current.setCell(0, 0, editedCell)
    const syncEditState = vi.fn()

    renderHook(() =>
      useEditReconciliation({
        data: createMockData("foo"),
        allColumns: MOCK_COLUMNS,
        editingState,
        isEditingEnabled: true,
        syncEditState,
      })
    )

    expect(editingState.current.getCell(0, 0)).toEqual(editedCell)
    expect(syncEditState).not.toHaveBeenCalled()
  })

  it("skips reconciliation when editing is disabled", () => {
    const editingState = {
      current: new EditingState(1),
    }
    const editedCell = MOCK_COLUMN.getCell("bar")
    editingState.current.setCell(0, 0, editedCell)
    const syncEditState = vi.fn()

    const { rerender } = renderHook(
      ({ data }) =>
        useEditReconciliation({
          data,
          allColumns: MOCK_COLUMNS,
          editingState,
          isEditingEnabled: false,
          syncEditState,
        }),
      { initialProps: { data: createMockData("foo") } }
    )

    rerender({ data: createMockData("bar") })

    expect(editingState.current.getCell(0, 0)).toEqual(editedCell)
    expect(syncEditState).not.toHaveBeenCalled()
  })

  it("reconciles when editing is re-enabled after a data refresh", () => {
    const editingState = {
      current: new EditingState(1),
    }
    editingState.current.setCell(0, 0, MOCK_COLUMN.getCell("bar"))
    const syncEditState = vi.fn()

    // Reuse the same data reference across the last two renders so that only
    // `isEditingEnabled` changes between them.
    const refreshedData = createMockData("bar")

    const { rerender } = renderHook(
      ({ data, isEditingEnabled }) =>
        useEditReconciliation({
          data,
          allColumns: MOCK_COLUMNS,
          editingState,
          isEditingEnabled,
          syncEditState,
        }),
      {
        initialProps: {
          data: createMockData("foo"),
          isEditingEnabled: false,
        },
      }
    )

    // Data refreshes while editing is disabled: reconciliation is skipped, so
    // the stale edit that now matches the source is preserved.
    rerender({ data: refreshedData, isEditingEnabled: false })
    expect(editingState.current.getCell(0, 0)).toBeDefined()
    expect(syncEditState).not.toHaveBeenCalled()

    // Re-enabling editing without another data change must trigger
    // reconciliation and clear the now-matching edit.
    rerender({ data: refreshedData, isEditingEnabled: true })
    expect(editingState.current.getCell(0, 0)).toBeUndefined()
    expect(syncEditState).toHaveBeenCalled()
  })
})
