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
export declare const INDEX_COLUMN_DESIGNATOR = "(index)";
/**
 * Returns the row indices for a DataFrame, sorted based on the values in the given
 * columnIdx. (Note that the columnIdx is 0-based, and so does *not* include the header column;
 * similarly, the sorted row indices will not include the header row.)
 */
export declare function getSortedDataRowIndices(df: any, sortColumnIdx: number, sortAscending: boolean): any[];
/**
 * Returns a dictionary of integers:
 *   { headerRows, headerCols, dataRows, dataCols, cols, rows }
 * for this DataFrame, where rows and cols are sums of the header and data
 * components.
 *
 * If df is null, this returns zeroes. If any of index/data/columns are null,
 * this treats them as empty (so their dimensions are [0, 0]).
 */
export declare function dataFrameGetDimensions(df: any): any;
/**
 * Returns [rows, cls] for this table.
 */
export declare function tableGetRowsAndCols(table: any): number[];
/**
 * Converts dataframe to array-of-dicts format.
 *
 * Example:
 *
 * [
 *   {index1: row1_col1, index2: row1_col2, ...},
 *   {index1: row2_col1, index2: row2_col2, ...},
 * ]
 */
export declare function dataFrameToArrayOfDicts(df: any): {
    [key: string]: any;
};
export type DataFrameCellType = "corner" | "col-header" | "row-header" | "data";
export interface DataFrameCell {
    contents: any;
    styles: any;
    type: DataFrameCellType;
}
/**
 * Return the (i, j)th element of the DataFrame viewed as a big table including
 * header columns and rows. Returns a dict of
 * {
 *  contents: <the cell contents, nicely formatted as a string>,
 *  styles: {property1: value1, ...} <css styles to apply to the cell>
 *  type: 'corner' | 'row-header' | 'col-header' | 'data'
 * }
 */
export declare function dataFrameGet(df: any, col: any, row: any): DataFrameCell;
/**
 * Returns the formatted string for the given element in a TableStyle,
 * or undefined if there's no such value.
 */
export declare function tableStyleGetDisplayValue(tableStyle: any, columnIndex: any, rowIndex: any): any | undefined;
/**
 * Returns a CSS style dictionary with keys that are formatted for use in a
 * JSX element's {style} attribute, or undefined if table/cell has no style.
 */
export declare function tableStyleGetCSS(tableStyle: any, columnIndex: any, rowIndex: any): any | undefined;
/**
 * Returns the given element from the table, formatted for display.
 */
export declare function tableGet(table: any, columnIndex: any, rowIndex: any): any;
/**
 * Returns the raw data of the given element from the table.
 */
export declare function tableData(table: any, columnIndex: any, rowIndex: any): any;
/**
 * Returns [levels, length]. The former is the length of the index, while the
 * latter is 1 (or >1 for MultiIndex).
 */
export declare function indexGetLevelsAndLength(index: any): any;
/**
 * Returns the ith index value of the given level.
 */
export declare function indexGet(index: any, level: any, i: any): any;
/**
 * Returns the numerical index of the column with the specified name within
 * this table. If no such column exists, returns -1.
 */
export declare function indexGetByName(index: any, name: string): number;
/**
 * Concatenates namedDataSet into element, returning a new element.
 */
export declare function addRows(element: any, namedDataSet: any): any;
