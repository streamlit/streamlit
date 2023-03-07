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
import { BaseColumn } from "./columns";
/**
 * The editing state keeps track of all table edits applied by the user.
 */
declare class EditingState {
    private editedCells;
    private addedRows;
    private deletedRows;
    private numRows;
    constructor(numRows: number);
    /**
     * Convert the current editing state to a JSON string.
     *
     * @param columns - The columns of the table
     * @returns JSON string
     */
    toJson(columns: BaseColumn[]): string;
    /**
     * Load the editing state from a JSON string.
     *
     * @param columns - The columns of the table
     * @returns JSON string
     */
    fromJson(editingStateJson: string, columns: BaseColumn[]): void;
    /**
     * Returns true if the given row was added by the user through the UI.
     */
    isAddedRow(row: number): boolean;
    /**
     * Returns the cell at the given column and row,
     * in case the cell was edited or added.
     *
     * @param col - The column index
     * @param row - The row index
     *
     * @returns The edited cell at the given column and row
     */
    getCell(col: number, row: number): GridCell | undefined;
    /**
     * Adds a cell to the editing state for the given column and row index.
     *
     * @param col - The column index
     * @param row - The row index
     * @param cell - The cell to add to the editing state
     */
    setCell(col: number, row: number, cell: GridCell): void;
    /**
     * Adds a new row to the editing state.
     *
     * @param rowCells - The cells of the row to add
     */
    addRow(rowCells: Map<number, GridCell>): void;
    /**
     * Deletes the given rows from the editing state.
     *
     * @param rows - The rows to delete
     */
    deleteRows(rows: number[]): void;
    /**
     * Deletes the given row from the editing state.
     *
     * @param row - The row to delete
     */
    deleteRow(row: number): void;
    /**
     * Returns the original row index of the given row.
     * Since the user can delete rows, the original row index and the
     * current one can diverge.
     *
     * @param row - The row index from the current state
     *
     * @returns The original row index
     */
    getOriginalRowIndex(row: number): number;
    /**
     * Returns the total number of rows of the current state.
     */
    getNumRows(): number;
}
export default EditingState;
