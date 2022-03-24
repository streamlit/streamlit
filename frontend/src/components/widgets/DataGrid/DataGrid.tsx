/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, useState } from "react"
import {
  DataEditor as GlideDataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  DataEditorProps,
  CompactSelection,
} from "@glideapps/glide-data-grid"

import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver } from "src/lib/Quiver"

import { getCellTemplate, fillCellTemplate } from "./DataGridCells"
import ThemedDataGridContainer from "./DataGridContainer"

export const ROW_HEIGHT = 35

/**
 * The GridColumn type extended with a function to get a template of the given type.
 */
type GridColumnWithCellTemplate = GridColumn & {
  getTemplate(): GridCell
}

/**
 * Returns a list of glide-data-grid compatible columns based on a Quiver instance.
 */
function getColumns(element: Quiver): GridColumnWithCellTemplate[] {
  const columns: GridColumnWithCellTemplate[] = []

  const numIndices = element.types?.index?.length ?? 0
  const numColumns = element.columns?.[0]?.length ?? 0

  if (!numIndices && !numColumns) {
    // Tables that don't have any columns cause an exception in glide-data-grid.
    // As a workaround, we are adding an empty index column in this case.
    columns.push({
      id: `empty-index`,
      title: "",
      hasMenu: false,
      getTemplate: () => {
        return getCellTemplate(GridCellKind.RowID, true)
      },
    } as GridColumnWithCellTemplate)
    return columns
  }

  for (let i = 0; i < numIndices; i++) {
    columns.push({
      id: `index-${i}`,
      // Indices currently have empty titles:
      title: "",
      hasMenu: false,
      getTemplate: () => {
        return getCellTemplate(GridCellKind.RowID, true)
      },
    } as GridColumnWithCellTemplate)
  }

  for (let i = 0; i < numColumns; i++) {
    const columnTitle = element.columns[0][i]

    columns.push({
      id: `column-${i}`,
      title: columnTitle,
      hasMenu: false,
      getTemplate: () => {
        return getCellTemplate(GridCellKind.Text, true)
      },
    } as GridColumnWithCellTemplate)
  }
  return columns
}

type DataLoaderReturn = { numRows: number } & Pick<
  DataEditorProps,
  "columns" | "getCellContent"
>

/**
 * A custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 * And features that influence the data representation and column configuration
 * such as column resizing, sorting, etc.
 */
function useDataLoader(element: Quiver): DataLoaderReturn {
  // The columns with the corresponding empty template for every type:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [columns, setColumns] = useState(() => getColumns(element))

  // Number of rows of the table minus 1 for the header row:
  const numRows = element.dimensions.rows - 1

  // TODO(lukasmasuch): Add sorting, column resizing and eventually selection functionality here.

  const getCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      const cellTemplate = columns[col].getTemplate()
      try {
        // Quiver has the index in 1 column and the header in first row
        const quiverCell = element.getCell(row + 1, col)
        return fillCellTemplate(cellTemplate, quiverCell)
      } catch (exception_var) {
        // This should not happen in read-only table.
        return cellTemplate
      }
    },
    [columns]
  )

  return {
    numRows,
    columns,
    getCellContent,
  }
}
export interface DataGridProps {
  element: Quiver
  height?: number
  width: number
}

function DataGrid({
  element,
  height: propHeight,
  width,
}: DataGridProps): ReactElement {
  const { numRows, columns, getCellContent } = useDataLoader(element)

  // Automatic height calculation: numRows +1 because of header, and +3 pixels for borders
  const height = propHeight || Math.min((numRows + 1) * ROW_HEIGHT + 3, 400)

  // Calculate min height for the resizable container. header + one column, and +3 pixels for borders
  const minHeight = 2 * ROW_HEIGHT + 3

  return (
    <ThemedDataGridContainer
      width={width}
      height={height}
      minHeight={minHeight}
    >
      <GlideDataEditor
        // Callback to get the content of a given cell location:
        getCellContent={getCellContent}
        // List with column configurations:
        columns={columns}
        // Number of rows:
        rows={numRows}
        // The height in pixel of a row:
        rowHeight={ROW_HEIGHT}
        // The height in pixels of the column headers:
        headerHeight={ROW_HEIGHT}
        // Deactivate row markers and numbers:
        rowMarkers={"none"}
        // Always activate smooth mode for horizontal scrolling:
        smoothScrollX={true}
        // Only activate smooth mode for vertical scrolling for large tables:
        smoothScrollY={numRows < 100000}
        // Show borders between cells:
        verticalBorder={true}
        // Deactivate column selection:
        selectedColumns={CompactSelection.empty()}
        onSelectedColumnsChange={() => {}}
        // Deactivate row selection:
        selectedRows={CompactSelection.empty()}
        onSelectedRowsChange={() => {}}
      />
    </ThemedDataGridContainer>
  )
}

export default withFullScreenWrapper(DataGrid)
