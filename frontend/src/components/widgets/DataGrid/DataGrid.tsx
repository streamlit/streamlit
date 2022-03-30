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

import React, { ReactElement, useState, useLayoutEffect } from "react"
import {
  DataEditor as GlideDataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  DataEditorProps,
  DataEditorRef,
} from "@glideapps/glide-data-grid"

import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver } from "src/lib/Quiver"
import { logError } from "src/lib/log"

import { getCellTemplate, fillCellTemplate } from "./DataGridCells"
import ThemedDataGridContainer from "./DataGridContainer"

const ROW_HEIGHT = 35
const MIN_COLUMN_WIDTH = 35
const MAX_COLUMN_WIDTH = 500

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
      title: "empty",
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

    const quiverType = element.types.data[i]
    let dataTypeName = undefined

    if (quiverType !== undefined) {
      dataTypeName = Quiver.getTypeName(quiverType)
    }

    let cellKind = GridCellKind.Text

    if (!dataTypeName) {
      // Use text cell as fallback
      cellKind = GridCellKind.Text
    } else if (["bool"].includes(dataTypeName)) {
      cellKind = GridCellKind.Boolean
    } else if (["int64", "float64"].includes(dataTypeName)) {
      cellKind = GridCellKind.Number
    } else if (dataTypeName.startsWith("list")) {
      cellKind = GridCellKind.Bubble
    }

    columns.push({
      id: `column-${i}`,
      title: columnTitle,
      hasMenu: false,
      getTemplate: () => {
        return getCellTemplate(cellKind, true)
      },
    } as GridColumnWithCellTemplate)
  }
  return columns
}

/**
 * Create return type for useDataLoader hook based on the DataEditorProps.
 */
type DataLoaderReturn = { numRows: number; numIndices: number } & Pick<
  DataEditorProps,
  "columns" | "getCellContent" | "onColumnResized"
>

/**
 * A custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 * And features that influence the data representation and column configuration
 * such as column resizing, sorting, etc.
 */
export function useDataLoader(element: Quiver): DataLoaderReturn {
  // The columns with the corresponding empty template for every type:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [columns, setColumns] = useState(() => getColumns(element))

  // Number of rows of the table minus 1 for the header row:
  const numRows = element.dimensions.rows - 1
  const numIndices = element.types?.index?.length ?? 0

  // TODO(lukasmasuch): Add sorting and eventually selection functionality here.

  const onColumnResized = React.useCallback(
    (column: GridColumn, newSize: number) => {
      setColumns(prevColumns => {
        const index = prevColumns.findIndex(ci => ci.id === column.id)
        const updatedColumns = [...prevColumns]
        updatedColumns.splice(index, 1, {
          ...prevColumns[index],
          width: newSize,
        })
        return updatedColumns
      })
    },
    [columns]
  )

  const getCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      const cellTemplate = columns[col].getTemplate()
      if (row > numRows - 1) {
        // TODO(lukasmasuch): This should never happen
        return cellTemplate
      }
      try {
        // Quiver has the index in 1 column and the header in first row
        const quiverCell = element.getCell(row + 1, col)
        return fillCellTemplate(cellTemplate, quiverCell)
      } catch (error) {
        // This should not happen in read-only table.
        logError(error)
        return cellTemplate
      }
    },
    [columns, numRows, element]
  )

  return {
    numRows,
    numIndices,
    columns,
    getCellContent,
    onColumnResized,
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
  width: propWidth,
}: DataGridProps): ReactElement {
  const {
    numRows,
    numIndices,
    columns,
    getCellContent,
    onColumnResized,
  } = useDataLoader(element)

  const [tableWidth, setTableWidth] = useState(propWidth)

  const dataEditorRef = React.useRef<DataEditorRef>(null)

  // Automatic table height calculation: numRows +1 because of header, and +3 pixels for borders
  const height = propHeight || Math.min((numRows + 1) * ROW_HEIGHT + 3, 400)

  // Calculate min height for the resizable container. header + one column, and +3 pixels for borders
  const minHeight = 2 * ROW_HEIGHT + 3

  return (
    <ThemedDataGridContainer
      width={tableWidth}
      height={height}
      minHeight={minHeight}
    >
      <GlideDataEditor
        ref={dataEditorRef}
        columns={columns}
        rows={numRows}
        minColumnWidth={MIN_COLUMN_WIDTH}
        maxColumnWidth={MAX_COLUMN_WIDTH}
        rowHeight={ROW_HEIGHT}
        headerHeight={ROW_HEIGHT}
        getCellContent={getCellContent}
        onColumnResized={onColumnResized}
        // Freeze all index columns:
        freezeColumns={numIndices}
        smoothScrollX={true}
        // Only activate smooth mode for vertical scrolling for large tables:
        smoothScrollY={numRows < 100000}
        // Show borders between cells:
        verticalBorder={true}
        // Activate copy to clipboard functionality:
        getCellsForSelection={true}
        // Deactivate row markers and numbers:
        rowMarkers={"none"}
        // Deactivate selections:
        rangeSelect={"none"}
        columnSelect={"none"}
        rowSelect={"none"}
        // Activate search:
        keybindings={{ search: true }}
      />
    </ThemedDataGridContainer>
  )
}

export default withFullScreenWrapper(DataGrid)
