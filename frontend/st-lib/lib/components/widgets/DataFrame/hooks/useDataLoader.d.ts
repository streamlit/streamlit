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
import React from "react";
import { DataEditorProps } from "@glideapps/glide-data-grid";
import { Quiver } from "src/lib/Quiver";
import EditingState from "src/components/widgets/DataFrame/EditingState";
import { BaseColumn } from "src/components/widgets/DataFrame/columns";
type DataLoaderReturn = Pick<DataEditorProps, "getCellContent">;
/**
 * Custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 *
 * @param data - The Arrow data extracted from the proto message
 * @param numRows - The number of rows of the current state (includes row additions/deletions)
 * @param editingState - The editing state of the data editor
 *
 * @returns the columns and the cell content getter compatible with glide-data-grid.
 */
declare function useDataLoader(data: Quiver, columns: BaseColumn[], numRows: number, editingState: React.MutableRefObject<EditingState>): DataLoaderReturn;
export default useDataLoader;
