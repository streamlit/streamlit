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
import { GridCell, DataEditorProps } from "@glideapps/glide-data-grid";
import { BaseColumn } from "src/components/widgets/DataFrame/columns";
type ColumnSortReturn = {
    columns: BaseColumn[];
    sortColumn: (index: number) => void;
    getOriginalIndex: (index: number) => number;
} & Pick<DataEditorProps, "getCellContent">;
/**
 * A React hook that provides column sorting functionality.
 *
 * @param numRows - The number of rows in the table.
 * @param columns - The columns of the table.
 *
 * @returns An object containing the following properties:
 * - `columns`: The updated list of columns.
 * - `sortColumn`: A function that sorts the column at the given index.
 * - `getOriginalIndex`: A function that returns the original index of the row at the given index.
 * - `getCellContent`: An updated function that returns the content of the cell at the given column and row indices.
 */
declare function useColumnSort(numRows: number, columns: BaseColumn[], getCellContent: ([col, row]: readonly [number, number]) => GridCell): ColumnSortReturn;
export default useColumnSort;
