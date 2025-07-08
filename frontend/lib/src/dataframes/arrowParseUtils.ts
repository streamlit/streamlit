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

/**
 * Utility functions used by Quiver to parse arrow data from IPC bytes.
 */

import {
  Schema as ArrowSchema,
  Dictionary,
  Field,
  Int,
  Null,
  Table,
  tableFromIPC,
  Vector,
} from "apache-arrow"
import range from "lodash/range"
import unzip from "lodash/unzip"

import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

import {
  ArrowType,
  convertVectorToList,
  DataFrameCellType,
  PandasRangeIndex,
  PandasRangeIndexType,
  PandasSchema,
} from "./arrowTypeUtils"

/**
 * Index data value.
 */
type IndexValue = Vector | number[]

/**
 * A row-major matrix of DataFrame index data values.
 */
export type IndexData = IndexValue[]

/**
 * A row-major matrix of DataFrame column header names.
 * This is a matrix (multidimensional array) to support multi-level headers.
 *
 * NOTE: ArrowJS automatically formats the columns in schema, i.e. we always get strings.
 */
export type ColumnNames = string[][]

/**
 * A row-major grid of DataFrame data.
 */
export type Data = Table

/** True if the index name represents a "range" index.
 *
 * This is only needed for parsing.
 */
function isPandasRangeIndex(
  indexName: string | PandasRangeIndex
): indexName is PandasRangeIndex {
  return typeof indexName === "object" && indexName.kind === "range"
}

/**
 * Parse the Pandas schema that is embedded as JSON string in the Arrow table.
 * This is only present if the table was processed through Pandas.
 */
function parsePandasSchema(table: Table): PandasSchema | undefined {
  const schema = table.schema.metadata.get("pandas")
  if (isNullOrUndefined(schema)) {
    // No Pandas schema found. This happens if the dataset
    // did not touch Pandas during serialization.
    return undefined
  }
  return JSON.parse(schema)
}

/** Parse DataFrame's index data values. */
function parsePandasIndexData(
  table: Table,
  pandasSchema?: PandasSchema
): IndexData {
  if (!pandasSchema) {
    // No Pandas schema found. This happens if the dataset
    // did not touch Pandas during serialization.
    return []
  }

  return pandasSchema.index_columns
    .map(indexCol => {
      if (isPandasRangeIndex(indexCol)) {
        // Range index is not part of the arrow data. Therefore,
        // we need to generate the range index data manually:
        const { start, stop, step } = indexCol
        return range(start, stop, step)
      }

      // Otherwise, use the index name to get the index column data.
      const column = table.getChild(indexCol)
      if (column instanceof Vector && column.type instanceof Null) {
        return null
      }
      return column
    })
    .filter(
      (column: IndexValue | null): column is IndexValue => column !== null
    )
}

/**
 * Parse a header name into a list of strings
 *
 * For a single-level header, the name is returned as a list with a single string.
 * For a multi-level header, the name is parsed into a list of strings.
 *
 * Example:
 * "('1','foo')" -> ["1", "foo"]
 * "foo" -> ["foo"]
 * "('1','foo (bar)')" -> ["1", "foo (bar)"]
 */
function parseHeaderName(name: string, numLevels: number): string[] {
  if (numLevels === 1) {
    return [name]
  }

  try {
    return JSON.parse(
      name.trim().replace(/^\(/, "[").replace(/\)$/, "]").replace(/'/g, '"')
    )
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    // Add empty strings for the missing levels
    return [...Array(numLevels - 1).fill(""), name]
  }
}
/** Parse DataFrame's column header names.
 *
 * This function is used to parse the column header names into a matrix of
 * column names. Multi-level headers will have more than one row of column names.
 *
 * @param dataColumnTypes - Type information for data columns.
 * @param pandasIndexColumnTypes - Type information for index columns.
 * @param pandasSchema - Pandas schema (if available).
 * @returns - Matrix of column names.
 */
function parseColumnNames(
  dataColumnTypes: ArrowType[],
  pandasIndexColumnTypes: ArrowType[],
  pandasSchema?: PandasSchema
): ColumnNames {
  const allArrowTypes = pandasIndexColumnTypes.concat(dataColumnTypes)

  // Perform the following transformation:
  // ["('1','foo')", "('2','bar')", "('3','baz')"] -> ... -> [["1", "2", "3"], ["foo", "bar", "baz"]]
  return unzip(
    allArrowTypes
      .map(type =>
        !type.arrowField.name.startsWith("__index_level_")
          ? type.arrowField.name
          : ""
      )
      .map(fieldName =>
        // If DataFrame `columns` has multi-level indexing, the length of
        // `column_indexes` will show how many levels there are.
        parseHeaderName(fieldName, pandasSchema?.column_indexes.length ?? 1)
      )
  )
}

/** Parse DataFrame's non-index data into a Table object. */
function parseData(table: Table, dataColumnTypes: ArrowType[]): Data {
  const numDataRows = table.numRows
  const numDataColumns = dataColumnTypes.length
  if (numDataRows === 0 || numDataColumns === 0) {
    return table.select([])
  }
  const dataColumnNames = dataColumnTypes.map(type => type.arrowField.name)
  return table.select(dataColumnNames)
}

/** Parsed Arrow table split into different components for easier access. */
interface ParsedTable {
  /** All index data cells.
   *
   * If the table was not processed through Pandas, this will be an empty array.
   */
  pandasIndexData: IndexData

  /** All data cells. */
  data: Data

  /** All column names. */
  columnNames: ColumnNames

  /** Type information for index columns. */
  pandasIndexColumnTypes: ArrowType[]

  /** Type information for data columns. */
  dataColumnTypes: ArrowType[]
}

/**
 * Parse type information for index columns from arrow and pandas schema.
 *
 * Index columns are only present if the dataframe was processed through Pandas.
 * The information about index columns is extracted from the pandas Schema.
 * For range indices, we need to create a new field with the correct type information
 * manually since range index columns are not part of the arrow schema. Arrow field
 * information for other index columns is extracted from the arrow schema.
 *
 * @param arrowSchema - Arrow schema to parse the index column types from.
 * @param pandasSchema - Pandas schema (if available).
 * @param categoricalOptions - Mapping of column names to categorical options.
 *
 * @returns - Type information for index columns.
 */
function parsePandasIndexColumnTypes(
  arrowSchema: ArrowSchema,
  pandasSchema: PandasSchema | undefined,
  categoricalOptions: Record<string, string[]>
): ArrowType[] {
  if (!pandasSchema) {
    // Index columns are only present if the table was processed through Pandas.
    return []
  }

  const pandasIndexColumnTypes: ArrowType[] = pandasSchema.index_columns.map(
    indexCol => {
      if (isPandasRangeIndex(indexCol)) {
        // Range indices are not part of the arrow schema, so we need to
        // create a new field with the correct type information manually:
        const indexName = indexCol.name || ""
        return {
          type: DataFrameCellType.INDEX,
          arrowField: new Field(indexName, new Int(true, 64), true),
          pandasType: {
            field_name: indexName,
            name: indexName,
            pandas_type: PandasRangeIndexType,
            numpy_type: PandasRangeIndexType,
            metadata: indexCol,
          },
        }
      }

      // Find the corresponding field in the arrow schema
      const field = arrowSchema.fields.find(f => f.name === indexCol)
      if (!field) {
        // This should never happen since the arrow schema should always contain
        // the index fields
        throw new Error(`Index field ${indexCol} not found in arrow schema`)
      }

      return {
        type: DataFrameCellType.INDEX,
        arrowField: field,
        pandasType: pandasSchema.columns.find(
          column => column.field_name === indexCol
        ),
        categoricalOptions: categoricalOptions[field.name],
      }
    }
  )

  return pandasIndexColumnTypes
}

/**
 * Parse type information for data columns.
 *
 * Data columns are all columns that are not part of the index.
 * The information about data columns is extracted from the pandas and arrow schema.
 *
 * @param arrowSchema - Arrow schema to parse the data column types from.
 * @param pandasSchema - Pandas schema (if available).
 * @param categoricalOptions - Mapping of column names to categorical options.
 *
 * @returns - Type information for data columns.
 */
function parseDataColumnTypes(
  arrowSchema: ArrowSchema,
  pandasSchema: PandasSchema | undefined,
  categoricalOptions: Record<string, string[]>
): ArrowType[] {
  const dataFields = arrowSchema.fields.filter(field =>
    pandasSchema ? !pandasSchema.index_columns.includes(field.name) : true
  )

  const dataColumnTypes: ArrowType[] = dataFields.map(field => {
    return {
      type: DataFrameCellType.DATA,
      arrowField: field,
      pandasType: pandasSchema?.columns.find(
        column => column.field_name === field.name
      ),
      categoricalOptions: categoricalOptions[field.name],
    }
  })

  return dataColumnTypes
}

/**
 * Parse categorical options for each column that has a categorical type
 *
 * We need to use table as parameter here since parsing the categorical options
 * requires access to the arrow schema and the arrow data.
 *
 * @param table - Arrow table to parse the categorical options from.
 * @returns - Categorical options for each column.
 */
function parseCategoricalOptionsForColumns(
  table: Table
): Record<string, string[]> {
  const categoricalOptions: Record<string, string[]> = {}
  table.schema.fields.forEach((field, index) => {
    if (field.type instanceof Dictionary) {
      const categoricalDict = table.getChildAt(index)?.data[0]?.dictionary
      if (notNullOrUndefined(categoricalDict)) {
        categoricalOptions[field.name] = convertVectorToList(categoricalDict)
      }
    }
  })
  return categoricalOptions
}

/**
 * Parse Arrow bytes (IPC format) into a couple of components
 * that allow easier and more efficient access to the data.
 *
 * @param ipcBytes - Arrow bytes (IPC format)
 * @returns - Parsed table components.
 */
export function parseArrowIpcBytes(
  ipcBytes: Uint8Array | null | undefined
): ParsedTable {
  // Load arrow table object from Arrow IPC bytes.
  // The table contains all the cell data, the arrow schema
  // and the pandas schema (if processed through Pandas).
  const table = tableFromIPC(ipcBytes)

  // The arrow schema contains type information for all columns
  // that are part of the table. This doesn't include range indices
  // which are only part of the pandas schema and need to be parsed
  // separately below.
  const arrowSchema = table.schema

  // Load pandas schema from metadata.
  // Pandas schema only exists if the table was processed through Pandas.
  const pandasSchema = parsePandasSchema(table)

  // Load categorical options for each column that has a categorical type.
  // This is a mapping of column names to categorical options that is
  // used in a later step to attach to the column type information.
  const categoricalOptions = parseCategoricalOptionsForColumns(table)

  // Load the type information for index columns.
  // Index columns refer to the row index (row labels) of a Pandas DataFrame:
  // https://pandas.pydata.org/docs/user_guide/indexing.html
  // Therefore, index columns are only present if the
  // table was processed through Pandas.
  const pandasIndexColumnTypes = parsePandasIndexColumnTypes(
    arrowSchema,
    pandasSchema,
    categoricalOptions
  )

  // Load the type information for data columns:
  const dataColumnTypes = parseDataColumnTypes(
    arrowSchema,
    pandasSchema,
    categoricalOptions
  )

  // Load all cell data for data columns:
  const data = parseData(table, dataColumnTypes)

  // Load all cell data for index columns.
  // Will be empty if the table was not processed through Pandas.
  const pandasIndexData = parsePandasIndexData(table, pandasSchema)

  // Load all index- & data-column names as a matrix.
  // This is a matrix (multidimensional array) to support multi-level headers.
  const columnNames = parseColumnNames(
    dataColumnTypes,
    pandasIndexColumnTypes,
    pandasSchema
  )

  return {
    pandasIndexData,
    data,
    columnNames,
    pandasIndexColumnTypes,
    dataColumnTypes,
  }
}
