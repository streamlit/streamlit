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
import { ComponentType, ReactElement } from "react";
import { SortDirection } from "./SortDirection";
export interface DataFrameCellProps {
    /** The cell's column index in the DataFrame */
    columnIndex: number;
    /** The cell's row index in the DataFrame */
    rowIndex: number;
    /** The cell's component to render */
    CellType: ComponentType;
    /** Additional css styling for the cell */
    style: Record<string, unknown>;
    /**
     * The HTML contents of the cell. Added to the DOM as a child of this
     * DataFrameCel.
     */
    contents: string;
    /**
     * If true, then the table's sorting was manually set by the user, by
     * clicking on a column header. We only show the sort arrow when this is
     * true.
     */
    sortedByUser: boolean;
    /**
     * The {@link SortDirection} for this column, or undefined if the column is
     * unsorted. No sorting is done here - this property is used to determine
     * which, if any, sort icon to draw in column-header cells.
     */
    columnSortDirection?: SortDirection;
    /**
     * An optional callback that will be called when a column header is clicked.
     * (The property is ignored for non-header cells). The callback will be passed this
     * cell's columnIndex.
     *
     * {@link DataFrame} uses this to toggle column sorting.
     */
    headerClickedCallback?: (columnIndex: number) => void;
}
export default function DataFrameCell({ CellType, columnIndex, contents, rowIndex, sortedByUser, style, columnSortDirection, headerClickedCallback, }: DataFrameCellProps): ReactElement;
