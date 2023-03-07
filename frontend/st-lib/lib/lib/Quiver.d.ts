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
import { StructRow, Table, Vector, Field, Dictionary, Struct } from "apache-arrow";
import { immerable } from "immer";
import { IArrow } from "src/autogen/proto";
/** Data types used by ArrowJS. */
export type DataType = null | boolean | number | string | Date | Int32Array | Uint8Array | Uint32Array | Vector | StructRow | Dictionary | Struct;
/**
 * A row-major grid of DataFrame index header values.
 */
type IndexValue = Vector | number[];
/**
 * A row-major grid of DataFrame index header values.
 */
type Index = IndexValue[];
/**
 * A row-major grid of DataFrame column header values.
 * NOTE: ArrowJS automatically formats the columns in schema, i.e. we always get strings.
 */
type Columns = string[][];
/**
 * A row-major grid of DataFrame data.
 */
type Data = Table;
/** DataFrame index and data types. */
interface Types {
    /** Types for each index column. */
    index: Type[];
    /** Types for each data column. */
    data: Type[];
}
/** Type information for single-index columns, and data columns. */
export interface Type {
    /** The type label returned by pandas.api.types.infer_dtype */
    pandas_type: IndexTypeName | string;
    /** The numpy dtype that corresponds to the types returned in df.dtypes */
    numpy_type: string;
    /** Type metadata. */
    meta?: Record<string, any> | null;
}
export declare enum IndexTypeName {
    CategoricalIndex = "categorical",
    DatetimeIndex = "datetime",
    Float64Index = "float64",
    Int64Index = "int64",
    RangeIndex = "range",
    UInt64Index = "uint64",
    UnicodeIndex = "unicode",
    PeriodIndex = "period[Q-DEC]",
    TimedeltaIndex = "time"
}
/** Dimensions of the DataFrame. */
interface DataFrameDimensions {
    headerRows: number;
    headerColumns: number;
    dataRows: number;
    dataColumns: number;
    rows: number;
    columns: number;
}
/**
 * There are 4 cell types:
 *  - blank, cells that are not part of index headers, column headers, or data
 *  - index, index header cells
 *  - columns, column header cells
 *  - data, data cells
 */
export declare enum DataFrameCellType {
    BLANK = "blank",
    INDEX = "index",
    COLUMNS = "columns",
    DATA = "data"
}
/** Data for a single cell in a DataFrame. */
export interface DataFrameCell {
    /** The cell's type (blank, index, columns, or data). */
    type: DataFrameCellType;
    /** The cell's CSS id, if the DataFrame has Styler. */
    cssId?: string;
    /** The cell's CSS class. */
    cssClass: string;
    /** The cell's content. */
    content: DataType;
    /** The cell's content type. */
    contentType?: Type;
    /** The cell's field. */
    field?: Field;
    /**
     * The cell's formatted content string, if the DataFrame was created with a Styler.
     * If the DataFrame is unstyled, displayContent will be undefined, and display
     * code should apply a default formatting to the `content` value instead.
     */
    displayContent?: string;
}
/**
 * Parses data from an Arrow table, and stores it in a row-major format
 * (which is more useful for our frontend display code than Arrow's columnar format).
 */
export declare class Quiver {
    /**
     * Plain objects (objects without a prototype), arrays, Maps and Sets are always drafted by Immer.
     * Every other object must use the immerable symbol to mark itself as compatible with Immer.
     * When one of these objects is mutated within a producer, its prototype is preserved between copies.
     * Source: https://immerjs.github.io/immer/complex-objects/
     */
    [immerable]: boolean;
    /** DataFrame's index (matrix of row names). */
    private _index;
    /** DataFrame's column labels (matrix of column names). */
    private _columns;
    /** DataFrame's index names. */
    private _indexNames;
    /** DataFrame's data. */
    private _data;
    /** Definition for DataFrame's fields. */
    private _fields;
    /** Types for DataFrame's index and data. */
    private _types;
    /** [optional] DataFrame's Styler data. This will be defined if the user styled the dataframe. */
    private readonly _styler?;
    constructor(element: IArrow);
    /** Parse Arrow table's schema from a JSON string to an object. */
    private static parseSchema;
    /** Get unprocessed column names for data columns. Needed for selecting
     * data columns when there are multi-columns. */
    private static getRawColumns;
    /** Parse DataFrame's index header values. */
    private static parseIndex;
    /** Parse DataFrame's index header names. */
    private static parseIndexNames;
    /** Parse DataFrame's column header values. */
    private static parseColumns;
    /** Parse DataFrame's data. */
    private static parseData;
    /** Parse DataFrame's index and data types. */
    private static parseTypes;
    /** Parse types for each index column. */
    private static parseIndexType;
    /**
     * Returns the categorical options defined for a given column.
     * Returns undefined if the column is not categorical.
     */
    getCategoricalOptions(columnIndex: number): string[] | undefined;
    /** Parse types for each non-index column. */
    private static parseDataType;
    /** Parse styler information from proto. */
    private static parseStyler;
    /** Concatenate the original DataFrame index with the given one. */
    private concatIndexes;
    /** True if both arrays contain the same index types in the same order. */
    private static sameIndexTypes;
    /** Concatenate the original DataFrame data with the given one. */
    private concatData;
    /** True if both arrays contain the same data types in the same order. */
    private static sameDataTypes;
    /** Concatenate index and data types. */
    private concatTypes;
    /** Concatenate index types. */
    private concatIndexTypes;
    /** Concatenate types of data columns. */
    private concatDataTypes;
    /** True if the index name represents a "range" index. */
    private static isRangeIndex;
    /** Formats an interval index. */
    private static formatIntervalType;
    private static formatInterval;
    private static formatTime;
    /** Returns type for a single-index column or data column. */
    static getTypeName(type: Type): IndexTypeName | string;
    /** Takes the data and it's type and nicely formats it. */
    static format(x: DataType, type?: Type, field?: Field): string;
    /** DataFrame's index (matrix of row names). */
    get index(): Index;
    /** DataFrame's index names. */
    get indexNames(): string[];
    /** DataFrame's column labels (matrix of column names). */
    get columns(): Columns;
    /** DataFrame's data. */
    get data(): Data;
    /** Types for DataFrame's index and data. */
    get types(): Types;
    /**
     * The DataFrame's CSS id, if it has one.
     *
     * If the DataFrame has a Styler, the  CSS id is `T_${StylerUUID}`. Otherwise,
     * it's undefined.
     *
     * This id is used by styled tables and styled dataframes to associate
     * the Styler CSS with the styled data.
     */
    get cssId(): string | undefined;
    /** The DataFrame's CSS styles, if it has a Styler. */
    get cssStyles(): string | undefined;
    /** The DataFrame's caption, if it's been set. */
    get caption(): string | undefined;
    /** The DataFrame's dimensions. */
    get dimensions(): DataFrameDimensions;
    /** True if the DataFrame has no index, columns, and data. */
    isEmpty(): boolean;
    /** Return a single cell in the table. */
    getCell(rowIndex: number, columnIndex: number): DataFrameCell;
    getIndexValue(rowIndex: number, columnIndex: number): any;
    getDataValue(rowIndex: number, columnIndex: number): any;
    /**
     * Add the contents of another table (data + indexes) to this table.
     * Extra columns will not be created.
     */
    addRows(other: Quiver): Quiver;
}
export {};
