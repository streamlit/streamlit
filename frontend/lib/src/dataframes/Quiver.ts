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

import { Field, Vector } from "apache-arrow"

import { ArrowData, IArrowData } from "@streamlit/protobuf"

import { hashString } from "~lib/util/utils"

import {
  ColumnNames,
  Data,
  IndexData,
  parseArrowIpcBytes,
} from "./arrowParseUtils"
import { ArrowType, DataFrameCellType, DataType } from "./arrowTypeUtils"

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

  /** Number of bytes in the Arrow IPC bytes. */
  private readonly _num_bytes: number

  constructor(arrowData: IArrowData) {
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
    this._num_bytes = arrowData.data?.length ?? 0
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
   * A hash that identifies the underlying data.
   *
   * This hash is based on various descriptive information
   * but is not 100% guaranteed to be unique.
   */
  public get hash(): string {
    // Calculate this at runtime for the eventual case that the underlying data changes.
    const valuesToHash = [
      this.dimensions.numColumns,
      this.dimensions.numDataColumns,
      this.dimensions.numDataRows,
      this.dimensions.numIndexColumns,
      this.dimensions.numHeaderRows,
      this.dimensions.numRows,
      this._num_bytes,
      this._columnNames,
    ]
    return hashString(valuesToHash.join("-"))
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

  /** Get the raw value of an index cell.
   *
   * Index columns only exist if the DataFrame was created based on a Pandas DataFrame.
   */
  private getIndexValue(rowIndex: number, columnIndex: number): DataType {
    const index = this._pandasIndexData[columnIndex]
    const value =
      index instanceof Vector ? index.get(rowIndex) : index[rowIndex]
    return value
  }

  /** Get the raw value of a data cell. */
  private getDataValue(rowIndex: number, columnIndex: number): DataType {
    return this._data.getChildAt(columnIndex)?.get(rowIndex)
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
