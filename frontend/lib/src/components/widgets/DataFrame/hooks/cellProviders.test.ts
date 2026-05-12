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

import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"
import { Field, Utf8 } from "apache-arrow"

import { IArrowData } from "@streamlit/protobuf"

import {
  BaseColumn,
  isErrorCell,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { Quiver } from "~lib/dataframes/Quiver"
import { UNICODE } from "~lib/mocks/arrow/types/unicode"

import {
  applyEditingOverlay,
  BaseCellProvider,
  createQuiverCellProvider,
  formatCell,
  RawCellData,
  resolveCellContent,
  withErrorBoundary,
} from "./cellProviders"
import EditingState from "./EditingState"

const MOCK_COLUMNS: BaseColumn[] = [
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
    isPinned: true,
    isStretched: false,
    title: "",
  }),
  TextColumn({
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("column-c1-0", new Utf8(), true),
      pandasType: {
        field_name: "column-c1-0",
        name: "column-c1-0",
        pandas_type: "unicode",
        numpy_type: "object",
        metadata: null,
      },
    },
    id: "column-c1-0",
    name: "c1",
    indexNumber: 1,
    isEditable: true,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
    title: "c1",
  }),
]

describe("cellProviders", () => {
  describe("createQuiverCellProvider", () => {
    it("creates a provider that reads cells from Quiver", () => {
      const arrowData: IArrowData = { data: UNICODE }
      const data = new Quiver(arrowData)
      const provider = createQuiverCellProvider(data)

      const rawCell = provider.getRawCell(0, 1)

      expect(rawCell).toBeDefined()
      expect(rawCell?.arrowCell.content).toBe("foo")
    })

    it("returns styled cell info when available", () => {
      const arrowData: IArrowData = { data: UNICODE }
      const data = new Quiver(arrowData)
      const provider = createQuiverCellProvider(data)

      const rawCell = provider.getRawCell(0, 0)

      expect(rawCell).toBeDefined()
      expect(rawCell?.arrowCell).toBeDefined()
    })
  })

  describe("applyEditingOverlay", () => {
    it('returns "raw" type when cell is not edited', () => {
      const arrowData: IArrowData = { data: UNICODE }
      const data = new Quiver(arrowData)
      const numRows = data.dimensions.numDataRows
      const editingState = new EditingState(numRows)
      const provider = createQuiverCellProvider(data)

      const result = applyEditingOverlay(
        0,
        MOCK_COLUMNS[1],
        editingState,
        provider
      )

      expect(result.type).toBe("raw")
      expect(
        (result as { type: "raw"; data: RawCellData }).data.arrowCell.content
      ).toBe("foo")
    })

    it('returns "edited" type when cell is edited', () => {
      const arrowData: IArrowData = { data: UNICODE }
      const data = new Quiver(arrowData)
      const numRows = data.dimensions.numDataRows
      const editingState = new EditingState(numRows)
      const provider = createQuiverCellProvider(data)

      editingState.setCell(1, 0, {
        kind: GridCellKind.Text,
        displayData: "edited",
        data: "edited",
        allowOverlay: true,
      })

      const result = applyEditingOverlay(
        0,
        MOCK_COLUMNS[1],
        editingState,
        provider
      )

      expect(result.type).toBe("edited")
      expect((result as { type: "edited"; cell: GridCell }).cell.kind).toBe(
        GridCellKind.Text
      )
    })

    it('returns "error" type for added row without cell data', () => {
      const arrowData: IArrowData = { data: UNICODE }
      const data = new Quiver(arrowData)
      const numRows = data.dimensions.numDataRows
      const editingState = new EditingState(numRows)
      const provider = createQuiverCellProvider(data)

      // Add a row with only partial cell data (missing column 1)
      const rowCells = new Map()
      rowCells.set(0, {
        kind: GridCellKind.Text,
        displayData: "index",
        data: "index",
        allowOverlay: true,
      })
      editingState.addRow(rowCells)

      // Mock getCell to return undefined for the missing cell
      const originalGetCell = editingState.getCell.bind(editingState)
      editingState.getCell = (col: number, row: number) => {
        const cell = originalGetCell(col, row)
        if (col === 1 && editingState.isAddedRow(row)) {
          return undefined
        }
        return cell
      }

      const result = applyEditingOverlay(
        numRows, // This is the added row
        MOCK_COLUMNS[1],
        editingState,
        provider
      )

      expect(result.type).toBe("error")
    })

    it("maps display row to original row through deleted rows", () => {
      const arrowData: IArrowData = { data: UNICODE }
      const data = new Quiver(arrowData)
      const numRows = data.dimensions.numDataRows
      const editingState = new EditingState(numRows)
      const provider = createQuiverCellProvider(data)

      editingState.deleteRow(0)

      const result = applyEditingOverlay(
        0,
        MOCK_COLUMNS[1],
        editingState,
        provider
      )

      expect(result.type).toBe("raw")
      expect(
        (result as { type: "raw"; data: RawCellData }).data.arrowCell.content
      ).toBe("bar")
    })
  })

  describe("formatCell", () => {
    it("formats raw cell data into a GridCell", () => {
      const arrowData: IArrowData = { data: UNICODE }
      const data = new Quiver(arrowData)
      const provider = createQuiverCellProvider(data)

      const rawData = provider.getRawCell(0, 1) as RawCellData
      const cell = formatCell(MOCK_COLUMNS[1], rawData)

      expect(cell.kind).toBe(GridCellKind.Text)
      expect(MOCK_COLUMNS[1].getCellValue(cell)).toBe("foo")
    })
  })

  describe("withErrorBoundary", () => {
    it("returns the cell when no error occurs", () => {
      const cell = withErrorBoundary(() => ({
        kind: GridCellKind.Text,
        displayData: "test",
        data: "test",
        allowOverlay: false,
      }))

      expect(cell.kind).toBe(GridCellKind.Text)
    })

    it("returns an error cell when an error occurs", () => {
      const cell = withErrorBoundary(() => {
        throw new Error("Test error")
      })

      expect(isErrorCell(cell)).toBe(true)
    })
  })

  describe("resolveCellContent", () => {
    it.each([
      [99, 0, "column"],
      [0, 99, "row"],
    ])("returns error cell for %s index out of bounds", (col, row) => {
      const arrowData: IArrowData = { data: UNICODE }
      const data = new Quiver(arrowData)
      const numRows = data.dimensions.numDataRows
      const editingState = new EditingState(numRows)
      const provider = createQuiverCellProvider(data)

      const cell = resolveCellContent(
        col,
        row,
        MOCK_COLUMNS,
        numRows,
        editingState,
        provider
      )

      expect(isErrorCell(cell)).toBe(true)
    })

    it("resolves cell content through all layers", () => {
      const arrowData: IArrowData = { data: UNICODE }
      const data = new Quiver(arrowData)
      const numRows = data.dimensions.numDataRows
      const editingState = new EditingState(numRows)
      const provider = createQuiverCellProvider(data)

      const cell = resolveCellContent(
        1,
        0,
        MOCK_COLUMNS,
        numRows,
        editingState,
        provider
      )

      expect(cell.kind).toBe(GridCellKind.Text)
      expect(MOCK_COLUMNS[1].getCellValue(cell)).toBe("foo")
    })

    it("returns edited cell when available", () => {
      const arrowData: IArrowData = { data: UNICODE }
      const data = new Quiver(arrowData)
      const numRows = data.dimensions.numDataRows
      const editingState = new EditingState(numRows)
      const provider = createQuiverCellProvider(data)

      editingState.setCell(1, 0, {
        kind: GridCellKind.Text,
        displayData: "edited value",
        data: "edited value",
        allowOverlay: true,
      })

      const cell = resolveCellContent(
        1,
        0,
        MOCK_COLUMNS,
        numRows,
        editingState,
        provider
      )

      expect(MOCK_COLUMNS[1].getCellValue(cell)).toBe("edited value")
    })

    it("catches errors from provider and returns error cell", () => {
      const arrowData: IArrowData = { data: UNICODE }
      const data = new Quiver(arrowData)
      const numRows = data.dimensions.numDataRows
      const editingState = new EditingState(numRows)

      const errorProvider: BaseCellProvider = {
        getRawCell: () => {
          throw new Error("Provider error")
        },
      }

      const cell = resolveCellContent(
        1,
        0,
        MOCK_COLUMNS,
        numRows,
        editingState,
        errorProvider
      )

      expect(isErrorCell(cell)).toBe(true)
    })
  })
})
