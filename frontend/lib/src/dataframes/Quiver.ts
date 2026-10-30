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

// Private members use _.

import { type Field, Vector } from "apache-arrow"

import type { ArrowData } from "@streamlit/protobuf"

import {
  type ColumnNames,
  type Data,
  type IndexData,
  parseArrowIpcBytes,
} from "./arrowParseUtils"
import {
  type ArrowType,
  DataFrameCellType,
  type DataType,
} from "./arrowTypeUtils"

/**
 * Pandas Styler data from proto message.
 *
 * This is only present if the DataFrame was created based
 * on a Pandas Styler object.
 */
interface PandasStylerData {
  /** UUID from Styler. */
  uuid: string

  /** Optional user-specified caption. */
  caption?: string

  /** CSS styles from Styler. */
  cssStyles?: string

  /** CSS ID to use for the Table.
   *
   * Format ot the CSS ID: `T_${StylerUUID}`
   *
   * This id is used by styled tables and styled dataframes to associate
   * the Styler CSS with the styled data.
   */
  cssId?: string

  /**
   * Stringified versions of each cell in the DataFrame, in the
   * user-specified format.
   *
   * The display values table is expected to always have the same
   * dimensions as the actual data table.
   */
  displayValues: Quiver
}

/** Dimensions of the DataFrame. */
interface DataFrameDimensions {
  // The number of header rows (> 1 for multi-level headers)
  numHeaderRows: number
  // The number of index columns
  numIndexColumns: number
  // The number of data rows (excluding header rows)
  numDataRows: number
  // The number of data columns (excluding index columns)
  numDataColumns: number
  // The total number of rows (header rows + data rows)
  numRows: number
  // The total number of columns (index + data columns)
  numColumns: number
}

/** Data for a single cell in a DataFrame. */
export interface DataFrameCell {
  /** The cell's type (index or data). */
  type: DataFrameCellType

  /** The cell's content. */
  content: DataType

  /** The cell's content type. */
  // For "blank" cells "contentType" is undefined.
  contentType: ArrowType

  /** The cell's field. */
  field: Field
}

/**
 * Parses data from an Arrow table, and stores it in a row-major format
 * (which is more useful for our frontend display code than Arrow's columnar format).
 *
 * Quiver instances are immutable. Do not pass them to Immer's `produce()` function
 * as they are not marked as draftable.
 */
export class Quiver {
  /** Index & data column names (matrix of column names to support multi-level headers). */
  private readonly _columnNames: ColumnNames

  /** Column type information for the (Pandas) index columns.
   *
   * Index columns only exist if the DataFrame was created based on a Pandas DataFrame.
   */
  private readonly _pandasIndexColumnTypes: ArrowType[]

  /** Column type information for the data columns. */
  private readonly _dataColumnTypes: ArrowType[]

  /** Column type information for all columns.
   *
   * This is a concatenation of the index and data column types
   * and needs to be updated whenever the index or data columns
   * change.
   */
  private readonly _columnTypes: ArrowType[]

  /** Cell values of the (Pandas) index columns.
   *
   *  Index columns only exist if the DataFrame was created based on a Pandas DataFrame.
   */
  private readonly _pandasIndexData: IndexData

  /** Cell values of the data columns. */
  private readonly _data: Data

  /** [optional] Pandas Styler data. This will be defined if the user styled the dataframe. */
  private readonly _styler?: PandasStylerData

  /** The Arrow IPC bytes this Quiver was parsed from. */
  private readonly _bytes: Uint8Array

  constructor(arrowData: ArrowData.$Properties) {
    const {
      pandasIndexData,
      columnNames,
      data,
      dataColumnTypes,
      pandasIndexColumnTypes,
    } = parseArrowIpcBytes(arrowData.data)

    // Load styler data (if provided):
    const styler = arrowData.styler
      ? parseStyler(arrowData.styler as ArrowData.PandasStyler)
      : undefined

    // The assignment is done below to avoid partially populating the instance
    // if an error is thrown.
    this._pandasIndexData = pandasIndexData
    this._columnNames = columnNames
    this._data = data
    this._dataColumnTypes = dataColumnTypes
    this._pandasIndexColumnTypes = pandasIndexColumnTypes
    this._styler = styler
    this._bytes = arrowData.data ?? new Uint8Array()
    this._columnTypes = this._pandasIndexColumnTypes.concat(
      this._dataColumnTypes
    )
  }

  /** Matrix of column names of the index- & data-columns.
   *
   * This is a matrix to support multi-level headers.
   * Index columns only exist if the DataFrame was created based on a Pandas DataFrame.
   */
  public get columnNames(): ColumnNames {
    return this._columnNames
  }

  /** List of column types for every index- & data-column. */
  public get columnTypes(): ArrowType[] {
    return this._columnTypes
  }

  /** Pandas Styler data. This will only be defined if the user styled the dataframe
   * via Pandas Styler.
   */
  public get styler(): PandasStylerData | undefined {
    return this._styler
  }

  /** Dimensions of the DataFrame. */
  public get dimensions(): DataFrameDimensions {
    const numIndexColumns = this._pandasIndexColumnTypes.length || 0
    const numHeaderRows = this._columnNames.length || 1
    const numDataRows = this._data.numRows || 0
    const numDataColumns = this._dataColumnTypes.length || 0

    const numRows = numHeaderRows + numDataRows
    const numColumns = numIndexColumns + numDataColumns

    return {
      numHeaderRows,
      numIndexColumns,
      numDataRows,
      numDataColumns,
      numRows,
      numColumns,
    }
  }

  /**
   * Whether `other` was parsed from byte-identical Arrow IPC data.
   *
   * Views of the same buffer region, such as a message the ForwardMsg cache
   * decodes again, match without a scan. Otherwise the comparison stops at
   * the first differing byte, so only identical data reads every byte (about
   * 15 ms for 16 MB).
   */
  public hasSameBytes(other: Quiver): boolean {
    const bytes = this._bytes
    const otherBytes = other._bytes
    if (bytes.length !== otherBytes.length) {
      return false
    }
    if (
      bytes.buffer === otherBytes.buffer &&
      bytes.byteOffset === otherBytes.byteOffset
    ) {
      return true
    }
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== otherBytes[i]) {
        return false
      }
    }
    return true
  }

  /** Return a single cell from an (Pandas) index- or data-column of the DataFrame.
   *
   * @param rowIndex - The row index of the cell (0 is the first data or index row excluding header rows)
   * @param columnIndex - The column index of the cell (0 is the first data or index column)
   * @returns The cell's content, type, and field.
   */
  public getCell(rowIndex: number, columnIndex: number): DataFrameCell {
    const { numIndexColumns, numDataRows, numColumns } = this.dimensions

    if (rowIndex < 0 || rowIndex >= numDataRows) {
      throw new Error(`Row index is out of range: ${rowIndex}`)
    }
    if (columnIndex < 0 || columnIndex >= numColumns) {
      throw new Error(`Column index is out of range: ${columnIndex}`)
    }

    const isIndexCell = columnIndex < numIndexColumns

    if (isIndexCell) {
      const contentType = this._pandasIndexColumnTypes[columnIndex]
      const content = this.getIndexValue(rowIndex, columnIndex)

      return {
        type: DataFrameCellType.INDEX,
        content,
        contentType,
        field: contentType.arrowField,
      }
    }

    const dataColumnIndex = columnIndex - numIndexColumns
    const contentType = this._dataColumnTypes[dataColumnIndex]
    const content = this.getDataValue(rowIndex, dataColumnIndex)

    return {
      type: DataFrameCellType.DATA,
      content,
      contentType,
      field: contentType.arrowField,
    }
  }

  /** Return a function that reads the raw values of a single data column.
   *
   * Use this to read every row of a column: the column is looked up once
   * instead of on every `getCell` call, which matters for large tables.
   *
   * @param dataColumnIndex - The data column index (0 is the first data column, excluding index columns)
   * @returns A function that takes a row index (0 is the first data row) and returns the cell's raw value. Row indexes are not range-checked.
   */
  public getDataColumnReader(
    dataColumnIndex: number
  ): (rowIndex: number) => DataType {
    if (
      dataColumnIndex < 0 ||
      dataColumnIndex >= this._dataColumnTypes.length
    ) {
      throw new Error(`Data column index is out of range: ${dataColumnIndex}`)
    }
    const column = this._data.getChildAt(dataColumnIndex)
    return rowIndex => column?.get(rowIndex) as DataType
  }

  /** Get the raw value of an index cell.
   *
   * Index columns only exist if the DataFrame was created based on a Pandas DataFrame.
   */
  private getIndexValue(rowIndex: number, columnIndex: number): DataType {
    const index = this._pandasIndexData[columnIndex]
    const value =
      index instanceof Vector
        ? (index.get(rowIndex) as DataType)
        : index[rowIndex]
    return value
  }

  /** Get the raw value of a data cell. */
  private getDataValue(rowIndex: number, columnIndex: number): DataType {
    return this._data.getChildAt(columnIndex)?.get(rowIndex) as DataType
  }
}

/** Parse Pandas styler information from proto. */
function parseStyler(pandasStyler: ArrowData.PandasStyler): PandasStylerData {
  return {
    uuid: pandasStyler.uuid,
    caption: pandasStyler.caption,
    cssStyles: pandasStyler.styles,
    cssId: pandasStyler.uuid ? `T_${pandasStyler.uuid}` : undefined,
    // Recursively create a new Quiver instance for Styler's display values.
    // This values will be used for rendering the DataFrame, while the original values
    // will be used for sorting, etc.
    displayValues: new Quiver({ data: pandasStyler.displayValues }),
  }
}
