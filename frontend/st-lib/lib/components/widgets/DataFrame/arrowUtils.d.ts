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
import { GridCell } from "@glideapps/glide-data-grid";
import { DataFrameCell, Quiver, Type as ArrowType } from "src/lib/Quiver";
import { BaseColumn, BaseColumnProps, ColumnCreator } from "./columns";
/**
 * Extracts a CSS property value from a given CSS style string by using a regex.
 *
 * @param htmlElementId - The ID of the HTML element to extract the property for.
 * @param property - The css property to extract the value for.
 * @param cssStyle - The css style string.
 *
 * @return the CSS property value or undefined if the property is not found.
 */
export declare function extractCssProperty(htmlElementId: string, property: string, cssStyle: string): string | undefined;
export declare function processDisplayData(displayData: string): string;
/**
 * Applies pandas styler CSS to style the cell.
 *
 * @param cell: The cell to style.
 * @param cssId: The css ID of the cell.
 * @param cssStyles: All CSS styles from pandas styler.
 *
 * @return a styled grid cell.
 */
export declare function applyPandasStylerCss(cell: GridCell, cssId: string, cssStyles: string): GridCell;
/**
 * Maps the data type from Arrow to a column type.
 */
export declare function getColumnTypeFromArrow(arrowType: ArrowType): ColumnCreator;
/**
 * Creates the column props for an index column from the Arrow metadata.
 *
 * @param data - The Arrow data.
 * @param indexPosition - The numeric position of the index column.
 *
 * @return the column props for the index column.
 */
export declare function getIndexFromArrow(data: Quiver, indexPosition: number): BaseColumnProps;
/**
 * Creates the column props for a data column from the Arrow metadata.
 *
 * @param data - The Arrow data.
 * @param columnPosition - The numeric position of the data column.
 *
 * @return the column props for the data column.
 */
export declare function getColumnFromArrow(data: Quiver, columnPosition: number): BaseColumnProps;
/**
 * Creates the column props for an empty index column.
 * This is used for DataFrames that don't have any index.
 * At least one column is required for glide.
 */
export declare function getEmptyIndexColumn(): BaseColumnProps;
/**
 * Creates the column props for all columns from the Arrow metadata.
 *
 * @param data - The Arrow data.
 * @return the column props for all columns.
 */
export declare function getAllColumnsFromArrow(data: Quiver): BaseColumnProps[];
/**
 * Returns a glide-data-grid compatible cell object based on the
 * cell data from the Quiver (Arrow) object. Different types of data will
 * result in different cell types.
 *
 * @param column - The colum of the cell.
 * @param arrowCell - The dataframe cell object from Arrow.
 * @param cssStyles - Optional css styles to apply on the cell.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export declare function getCellFromArrow(column: BaseColumn, arrowCell: DataFrameCell, cssStyles?: string | undefined): GridCell;
