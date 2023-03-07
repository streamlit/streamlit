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
import React, { ReactElement, ComponentType } from "react";
import { Map as ImmutableMap } from "immutable";
/**
 * Height of dataframe row.
 */
export declare const ROW_HEIGHT: number;
/**
 * Minimum size of a dataframe cell.
 */
export declare const MIN_CELL_WIDTH_PX = 25;
export interface CellContents {
    Component: ComponentType;
    styles: Record<string, unknown>;
    contents: string;
}
export interface CellContentsGetter {
    (columnIndex: number, rowIndex: number): CellContents;
}
export interface CellContentsGetterProps {
    element: ImmutableMap<string, any>;
    headerRows: number;
    sortedDataRowIndices?: number[];
}
export interface CellRendererInput {
    columnIndex: number;
    key: string;
    rowIndex: number;
    style: React.CSSProperties;
}
export interface CellRenderer {
    (input: CellRendererInput): ReactElement;
}
interface Dimensions {
    rowHeight: number;
    headerHeight: number;
    border: number;
    height: number;
    elementWidth: number;
    columnWidth: ({ index }: {
        index: number;
    }) => number;
    headerWidth: number;
}
interface ComputedWidths {
    elementWidth: number;
    columnWidth: ({ index }: {
        index: number;
    }) => number;
    headerWidth: number;
}
/**
 * Returns rendering dimensions for a DataFrame
 */
export declare const getDimensions: (height: number | undefined, width: number, element: ImmutableMap<string, any>, cellContentsGetter: CellContentsGetter) => Dimensions;
/**
 * Returns a function which can access individual cell data in a DataFrame.
 *
 * The returned function has the form:
 *
 * cellContentsGetter(columnIndex: int, rowIndex: int) -> {
 *    classes: str - a css class string
 *    styles: {property1: value1, ...} - css styles to apply to the cell
 *    contents: str - the cell's formatted display string
 * }
 *
 * element              - a DataFrame
 * headerRows           - the number of frozen rows
 * headerCols           - the number of frozen columns
 * sortedDataRowIndices - (optional) an array containing an ordering for row indices
 */
export declare function getCellContentsGetter({ element, headerRows, sortedDataRowIndices, }: CellContentsGetterProps): CellContentsGetter;
/**
 * Computes various dimensions for the table.
 *
 * First of all we create an array containing all the calculated column widths,
 * if the difference between the total of columns and the container width is negative
 * we put a width limit, if not, we divide the remaining space by each exceeding width
 */
export declare function getWidths(cols: number, rows: number, headerCols: number, headerRows: number, containerWidth: number, cellContentsGetter: CellContentsGetter): ComputedWidths;
export {};
