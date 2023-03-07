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
import { GridCell, Theme as GlideTheme, TextCell, LoadingCell, GridColumn } from "@glideapps/glide-data-grid";
import { Type as ArrowType } from "src/lib/Quiver";
/**
 * Interface used for defining the properties (configuration options) of a column.
 * These options can also be used to overwrite from user-defined column config.
 */
export interface BaseColumnProps {
    readonly id: string;
    readonly title: string;
    readonly indexNumber: number;
    readonly arrowType: ArrowType;
    readonly isEditable: boolean;
    readonly isHidden: boolean;
    readonly isIndex: boolean;
    readonly isStretched: boolean;
    readonly width?: number;
    readonly customType?: string;
    readonly columnTypeMetadata?: Record<string, any>;
    readonly contentAlignment?: "left" | "center" | "right";
    readonly themeOverride?: Partial<GlideTheme>;
}
/**
 * The interface that is implemented by any column type.
 */
export interface BaseColumn extends BaseColumnProps {
    readonly kind: string;
    readonly sortMode: "default" | "raw" | "smart";
    getCell(data?: any): GridCell;
    getCellValue(cell: GridCell): any | null;
}
/**
 * A type that describes the function signature used to create a column based on
 * some column properties.
 */
export type ColumnCreator = {
    (props: BaseColumnProps): BaseColumn;
    readonly isEditableType: boolean;
};
/**
 * Interface used for indicating if a cell contains an error.
 */
interface ErrorCell extends TextCell {
    readonly isError: true;
}
/**
 * Returns a cell with an error message.
 *
 * @param errorMsg: A short error message to use as display value.
 * @param errorDetails: The full error message to show when the user
 *                     clicks on a cell.
 *
 * @return a read-only GridCell object that can be used by glide-data-grid.
 */
export declare function getErrorCell(errorMsg: string, errorDetails?: string): ErrorCell;
/**
 * Returns `true` if the given cell contains an error.
 * This can happen if the value type is not compatible with
 * the given value type.
 */
export declare function isErrorCell(cell: GridCell): cell is ErrorCell;
/**
 * Interface used for indicating if a cell contains no value.
 */
interface MissingValueCell extends TextCell {
    readonly isMissingValue: true;
}
/**
 * Returns `true` if the given cell contains no value (-> missing value).
 * For example, a number cell that contains null is interpreted as a missing value.
 */
export declare function isMissingValueCell(cell: GridCell): cell is MissingValueCell;
/**
 * Returns an empty cell.
 */
export declare function getEmptyCell(): LoadingCell;
/**
 * Returns an empty text cell.
 *
 * @param readonly: If true, returns a read-only version of the cell.
 * @param faded: If true, returns a faded version of the cell.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export declare function getTextCell(readonly: boolean, faded: boolean): TextCell;
/**
 * Converts from our BaseColumn format to the glide-data-grid compatible GridColumn.
 */
export declare function toGlideColumn(column: BaseColumn): GridColumn;
/**
 * Merges the default column parameters with the user-defined column parameters.
 *
 * @param defaultParams - The default column parameters.
 * @param userParams - The user-defined column parameters.
 *
 * @returns The merged column parameters.
 */
export declare function mergeColumnParameters(defaultParams: Record<string, any> | undefined | null, userParams: Record<string, any> | undefined | null): Record<string, any>;
/**
 * Converts the given value of unknown type to an array without
 * the risks of any exceptions.
 *
 * @param data - The value to convert to an array.
 *
 * @returns The converted array or an empty array if the value cannot be interpreted as an array.
 */
export declare function toSafeArray(data: any): any[];
/**
 * Converts the given value of unknown type to a string without
 * the risks of any exceptions.
 *
 * @param data - The value to convert to a string.
 *
 * @return The converted string or a string showing the type of the object as fallback.
 */
export declare function toSafeString(data: any): string;
/**
 * Converts the given value of unknown type to a number without
 * the risks of any exceptions.
 *
 * @param value - The value to convert to a number.
 *
 * @returns The converted number or null if the value cannot be interpreted as a number.
 */
export declare function toSafeNumber(value: any): number | null;
/**
 * Formats the given number to a string with the given maximum precision.
 *
 * @param value - The number to format.
 * @param maxPrecision - The maximum number of decimals to show.
 * @param keepTrailingZeros - Whether to keep trailing zeros.
 *
 * @returns The formatted number as a string.
 */
export declare function formatNumber(value: number, maxPrecision?: number, keepTrailingZeros?: boolean): string;
export {};
