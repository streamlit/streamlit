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

import React, { ReactElement, useState } from "react"
import {
  DataEditor as GlideDataEditor,
  EditableGridCell,
  GridCell,
  GridColumn,
  DataEditorProps,
  DataEditorRef,
  GridSelection,
  CompactSelection,
  GridMouseEventArgs,
  Theme as GlideTheme,
  isEditableGridCell,
} from "@glideapps/glide-data-grid"
import { Resizable, Size as ResizableSize } from "re-resizable"
import { useColumnSort } from "@glideapps/glide-data-grid-source"
import { useExtraCells } from "@glideapps/glide-data-grid-cells"
import { transparentize } from "color2k"
import { useTheme } from "@emotion/react"

import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver, Type as QuiverType, DataType } from "src/lib/Quiver"
import { logError } from "src/lib/log"
import { Theme } from "src/theme"
import { notNullOrUndefined } from "src/lib/utils"
import { Arrow as ArrowProto } from "src/autogen/proto"

import {
  getCellTemplate,
  fillCellTemplate,
  getColumnSortMode,
  getColumnTypeFromQuiver,
  ColumnType,
  getColumnTypeFromConfig,
  updateCell,
} from "./DataFrameCells"
import { StyledResizableContainer } from "./styled-components"

import "@glideapps/glide-data-grid/dist/index.css"

const ROW_HEIGHT = 35
const MIN_COLUMN_WIDTH = 35
const MAX_COLUMN_WIDTH = 650
// Min width for the resizable table container:
// Based on one column at minimum width + 2 for borders + 1 to prevent overlap problem with selection ring.
const MIN_TABLE_WIDTH = MIN_COLUMN_WIDTH + 3
// Min height for the resizable table container:
// Based on header + one column, and + 2 for borders + 1 to prevent overlap problem with selection ring.
const MIN_TABLE_HEIGHT = 2 * ROW_HEIGHT + 3
const DEFAULT_TABLE_HEIGHT = 400

/**
 * The GridColumn type extended with a function to get a template of the given type.
 */
// TODO: rename
type Column = GridColumn & {
  // The type of the column.
  columnType: ColumnType
  // The index number of the column.
  columnIndex: number
  // The quiver data type of the column.
  quiverType: QuiverType
  // If `True`, the column can be edited.
  isEditable: boolean
  // If `True`, the column is hidden (will not be shown).
  isHidden: boolean
  // If `True`, the column is a table index.
  isIndex: boolean
}

/**
 * Options to configure columns.
 */
interface ColumnConfigProps {
  width?: number
  title?: string
  type?: string
  hidden?: boolean
  editable?: boolean
}

/**
 * Configuration type for column sorting hook.
 */
type ColumnSortConfig = {
  column: GridColumn
  mode?: "default" | "raw" | "smart"
  direction?: "asc" | "desc"
}

/**
 * The editing state of the DataFrame.
 */
class EditingState {
  // column -> row -> value
  private cachedContent: Map<number, Map<number, GridCell>> = new Map()

  get(col: number, row: number): GridCell | undefined {
    const colCache = this.cachedContent.get(col)

    if (colCache === undefined) {
      return undefined
    }

    return colCache.get(row)
  }

  set(col: number, row: number, value: GridCell): void {
    if (this.cachedContent.get(col) === undefined) {
      this.cachedContent.set(col, new Map())
    }

    const rowCache = this.cachedContent.get(col) as Map<number, GridCell>
    rowCache.set(row, value)
  }
}

/**
 * Creates a glide-data-grid compatible theme based on our theme configuration.
 *
 * @param theme: Our theme configuration.
 *
 * @return a glide-data-grid compatible theme.
 */
export function createDataFrameTheme(theme: Theme): Partial<GlideTheme> {
  return {
    // Explanations: https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#theme
    accentColor: theme.colors.primary,
    accentFg: theme.colors.white,
    accentLight: transparentize(theme.colors.primary, 0.9),
    borderColor: theme.colors.fadedText05,
    fontFamily: theme.genericFonts.bodyFont,
    bgSearchResult: transparentize(theme.colors.primary, 0.9),
    // Header styling:
    bgIconHeader: theme.colors.fadedText60,
    fgIconHeader: theme.colors.white,
    bgHeader: theme.colors.bgMix,
    bgHeaderHasFocus: theme.colors.secondaryBg,
    bgHeaderHovered: theme.colors.bgMix, // uses same color as bgHeader to deactivate the hover effect
    textHeader: theme.colors.fadedText60,
    textHeaderSelected: theme.colors.white,
    headerFontStyle: `${theme.fontSizes.sm}`,
    // Cell styling:
    baseFontStyle: theme.fontSizes.sm,
    editorFontSize: theme.fontSizes.sm,
    textDark: theme.colors.bodyText,
    textMedium: transparentize(theme.colors.bodyText, 0.2),
    textLight: theme.colors.fadedText60,
    textBubble: theme.colors.fadedText60,
    bgCell: theme.colors.bgColor,
    bgCellMedium: theme.colors.bgColor, // uses same as bgCell to always have the same background color
    cellHorizontalPadding: 8,
    cellVerticalPadding: 3,
    // Special cells:
    bgBubble: theme.colors.secondaryBg,
    bgBubbleSelected: theme.colors.secondaryBg,
    linkColor: theme.colors.linkText,
    drilldownBorder: theme.colors.darkenedBgMix25,
  }
}

/**
 * Apply the column configuration if supplied.
 */
function applyColumnConfig(
  column: Column,
  columnsConfig: Map<string | number, ColumnConfigProps>
): Column | null {
  if (!columnsConfig) {
    // No column config configured
    return column
  }

  let columnConfig
  if (columnsConfig.has(column.title)) {
    columnConfig = columnsConfig.get(column.title)
  } else if (columnsConfig.has(`index:${column.columnIndex}`)) {
    columnConfig = columnsConfig.get(`index:${column.columnIndex}`)
  }

  if (!columnConfig) {
    // No column config found for this column
    return column
  }

  if (
    notNullOrUndefined(columnConfig.hidden) &&
    columnConfig.hidden === true
  ) {
    // If column is hidden, return null
    return null
  }

  return {
    ...column,
    // Update title:
    ...(notNullOrUndefined(columnConfig.title)
      ? {
          title: columnConfig.title,
        }
      : {}),
    // Update width:
    ...(notNullOrUndefined(columnConfig.width)
      ? {
          width: Math.min(
            Math.max(columnConfig.width, MIN_COLUMN_WIDTH),
            MAX_COLUMN_WIDTH
          ),
        }
      : {}),
    // Update data type:
    ...(notNullOrUndefined(columnConfig.type)
      ? {
          columnType: getColumnTypeFromConfig(columnConfig.type),
        }
      : {}),
    // Update editable state:
    ...(notNullOrUndefined(columnConfig.editable)
      ? {
          isEditable: columnConfig.editable,
        }
      : {}),
  } as Column
}

/**
 * Returns a list of glide-data-grid compatible columns based on a Quiver instance.
 */
export function getColumns(
  element: ArrowProto,
  data: Quiver,
  columnsConfig: Map<string, ColumnConfigProps>
): Column[] {
  const columns: Column[] = []
  const stretchColumn = element.useContainerWidth || element.width

  if (data.isEmpty()) {
    // Tables that don't have any columns cause an exception in glide-data-grid.
    // As a workaround, we are adding an empty index column in this case.
    columns.push({
      id: `empty-index`,
      title: "",
      hasMenu: false,
      columnType: ColumnType.Text,
      columnIndex: 0,
      isEditable: false,
      isIndex: true,
      ...(stretchColumn ? { grow: 1 } : {}),
    } as Column)
    return columns
  }

  const numIndices = data.types?.index?.length ?? 0
  const numColumns = data.columns?.[0]?.length ?? 0

  for (let i = 0; i < numIndices; i++) {
    const quiverType = data.types.index[i]
    const columnType = getColumnTypeFromQuiver(quiverType)

    const column = {
      id: `index-${i}`,
      title: "", // Indices have empty titles as default.
      hasMenu: false,
      columnType,
      quiverType,
      columnIndex: i,
      isEditable: false,
      isHidden: false,
      isIndex: true,
      ...(stretchColumn ? { grow: 1 } : {}),
    } as Column

    const updatedColumn = applyColumnConfig(column, columnsConfig)
    // If column is hidden, the return value is null.
    if (updatedColumn) {
      columns.push(updatedColumn)
    }
  }

  for (let i = 0; i < numColumns; i++) {
    const columnTitle = data.columns[0][i]
    const quiverType = data.types.data[i]
    const columnType = getColumnTypeFromQuiver(quiverType)

    const column = {
      id: `column-${columnTitle}-${i}`,
      title: columnTitle,
      hasMenu: false,
      columnType,
      quiverType,
      columnIndex: i + numIndices,
      isEditable: false,
      isHidden: false,
      isIndex: false,
      ...(stretchColumn ? { grow: 3 } : {}),
    } as Column

    const updatedColumn = applyColumnConfig(column, columnsConfig)
    // If column is hidden, the return value is null.
    if (updatedColumn) {
      columns.push(updatedColumn)
    }
  }
  return columns
}

/**
 * Updates the column headers based on the sorting configuration.
 */
function updateSortingHeader(
  columns: Column[],
  sort: ColumnSortConfig | undefined
): Column[] {
  if (sort === undefined) {
    return columns
  }
  return columns.map(column => {
    if (column.id === sort.column.id) {
      return {
        ...column,
        title:
          sort.direction === "asc" ? `↑ ${column.title}` : `↓ ${column.title}`,
      }
    }
    return column
  })
}

/**
 * Create return type for useDataLoader hook based on the DataEditorProps.
 */
type DataLoaderReturn = { numRows: number } & Pick<
  DataEditorProps,
  "columns" | "getCellContent" | "onColumnResize" | "onCellEdited"
>

/**
 * A custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 * And features that influence the data representation and column configuration
 * such as column resizing, sorting, etc.
 */
export function useDataLoader(
  element: ArrowProto,
  data: Quiver,
  sort?: ColumnSortConfig | undefined
): DataLoaderReturn {
  const editingState = React.useRef<EditingState>(new EditingState())
  // The columns with the corresponding empty template for every type:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [columnSizes, setColumnSizes] = useState<Map<string, number>>(
    () => new Map()
  )

  // TODO (lukasmasuch): Support column configuration
  // const columnsConfig = element.columns ? new Map(Object.entries(JSON.parse(element.columns))) : new Map()

  const columns = getColumns(element, data, new Map()).map(column => {
    // Apply column widths from state
    if (
      column.id &&
      columnSizes.has(column.id) &&
      columnSizes.get(column.id) !== undefined
    ) {
      return {
        ...column,
        width: columnSizes.get(column.id),
        grow: 0, // Deactivate grow for this column
      } as Column
    }
    return column
  })

  // Number of rows of the table minus 1 for the header row:
  const numRows = data.isEmpty() ? 1 : data.dimensions.rows - 1
  // TODO(lukasmasuch): Remove? const numIndices = data.types?.index?.length ?? 0

  const onColumnResize = React.useCallback(
    (
      column: GridColumn,
      newSize: number,
      colIndex: number,
      newSizeWithGrow: number
    ) => {
      if (column.id) {
        setColumnSizes(new Map(columnSizes).set(column.id, newSizeWithGrow))
      }
    },
    [columns]
  )

  const getCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      if (data.isEmpty()) {
        return {
          ...getCellTemplate(ColumnType.Text, true, true),
          displayData: "empty",
        } as GridCell
      }

      if (col > columns.length - 1) {
        // This should never happen
        // TODO (lukasmasuch): use error cell?
        return getCellTemplate(ColumnType.Text, true, false)
      }

      const column = columns[col]
      const cellTemplate = getCellTemplate(
        column.columnType,
        !column.isEditable,
        column.isIndex
      )

      if (row > numRows - 1) {
        // This should never happen
        return cellTemplate
      }

      try {
        // Quiver has the header in first row
        const quiverCell = data.getCell(row + 1, column.columnIndex)
        return fillCellTemplate(cellTemplate, quiverCell, data.cssStyles)
      } catch (error) {
        // This should not happen in read-only table.
        logError(error)
        return cellTemplate
      }
    },
    [columns, numRows, data]
  )

  const { getCellContent: getCellContentSorted, getOriginalIndex } =
    useColumnSort({
      columns,
      getCellContent,
      rows: numRows,
      sort,
    })

  const updatedColumns = updateSortingHeader(columns, sort)

  const onCellEdited = React.useCallback(
    (
      [col, row]: readonly [number, number],
      newVal: EditableGridCell
    ): void => {
      // TODO (lukasmasuch): Check for disabled flag
      // if (element.disabled === true) {
      //   // TODO: check for editable flag
      //   // element.editable === false ||
      //   return
      // }

      const currentCell = getCellContentSorted([col, row])
      const column = updatedColumns[col]

      if (
        !isEditableGridCell(newVal) ||
        !isEditableGridCell(currentCell) ||
        !column.isEditable
      ) {
        return
      }

      // TODO (lukasmasuch): check if type is compatible with DataType instead
      if (
        typeof newVal.data === "string" ||
        typeof newVal.data === "number" ||
        typeof newVal.data === "boolean"
      ) {
        // TODO: support display values
        editingState.current.set(
          col,
          getOriginalIndex(row),
          updateCell(currentCell, newVal.data as DataType)
        )
      }
    },
    [columns]
  )

  return {
    numRows,
    columns: updatedColumns,
    getCellContent: getCellContentSorted,
    onColumnResize,
    onCellEdited,
  }
}
export interface DataFrameProps {
  element: ArrowProto
  data: Quiver
  width: number
  height?: number
  isFullScreen?: boolean
}

function DataFrame({
  element,
  data,
  width: containerWidth,
  height: containerHeight,
  isFullScreen,
}: DataFrameProps): ReactElement {
  const extraCellArgs = useExtraCells()
  const [sort, setSort] = React.useState<ColumnSortConfig>()
  const dataEditorRef = React.useRef<DataEditorRef>(null)
  const theme: Theme = useTheme()

  const stretchColumn = element.useContainerWidth || element.width

  const { numRows, columns, getCellContent, onColumnResize, onCellEdited } =
    useDataLoader(element, data, sort)
  const [isFocused, setIsFocused] = React.useState<boolean>(true)

  const [gridSelection, setGridSelection] = React.useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  })

  const resizableRef = React.useRef<Resizable>(null)

  const onHeaderClick = React.useCallback(
    (index: number) => {
      let sortDirection = "asc"
      const clickedColumn = columns[index]

      if (sort && sort.column.id === clickedColumn.id) {
        // The clicked column is already sorted
        if (sort.direction === "asc") {
          // Sort column descending
          sortDirection = "desc"
        } else {
          // Remove sorting of column
          setSort(undefined)
          return
        }
      }

      setSort({
        column: clickedColumn,
        direction: sortDirection,
        mode: getColumnSortMode((clickedColumn as Column).columnType),
      } as ColumnSortConfig)
    },
    [sort, columns]
  )

  // Automatic table height calculation: numRows +1 because of header, and +2 pixels for borders
  let maxHeight = Math.max(
    (numRows + 1) * ROW_HEIGHT + 1 + 2,
    MIN_TABLE_HEIGHT
  )
  let initialHeight = Math.min(maxHeight, DEFAULT_TABLE_HEIGHT)

  if (element.height) {
    // User has explicitly configured a height
    initialHeight = Math.max(element.height, MIN_TABLE_HEIGHT)
    maxHeight = Math.max(element.height, maxHeight)
  }

  if (containerHeight) {
    // If container height is set (e.g. when used in fullscreen)
    // The maxHeight and height should not be larger than container height
    initialHeight = Math.min(initialHeight, containerHeight)
    maxHeight = Math.min(maxHeight, containerHeight)

    if (!element.height) {
      // If no explicit height is set, set height to max height (fullscreen mode)
      initialHeight = maxHeight
    }
  }

  let initialWidth: number | undefined // If container width is undefined, auto set based on column widths
  let maxWidth = containerWidth

  if (element.useContainerWidth) {
    // Always use the full container width
    initialWidth = containerWidth
  } else if (element.width) {
    // User has explicitly configured a width
    initialWidth = Math.min(
      Math.max(element.width, MIN_TABLE_WIDTH),
      containerWidth
    )
    maxWidth = Math.min(Math.max(element.width, maxWidth), containerWidth)
  }

  const [resizableSize, setResizableSize] = React.useState<ResizableSize>({
    width: initialWidth || "100%",
    height: initialHeight,
  })

  React.useLayoutEffect(() => {
    // This prevents weird table resizing behavior if the container width
    // changes and the table uses the full container width.
    if (
      resizableRef.current &&
      element.useContainerWidth &&
      resizableSize.width === "100%"
    ) {
      setResizableSize({
        width: containerWidth,
        height: resizableSize.height,
      })
    }
  }, [containerWidth])

  React.useLayoutEffect(() => {
    if (resizableRef.current) {
      // Reset the height if the number of rows changes (e.g. via add_rows)
      setResizableSize({
        width: resizableSize.width,
        height: initialHeight,
      })
    }
  }, [numRows])

  React.useLayoutEffect(() => {
    if (resizableRef.current) {
      if (isFullScreen) {
        setResizableSize({
          width: stretchColumn ? maxWidth : "100%",
          height: maxHeight,
        })
      } else {
        setResizableSize({
          width: initialWidth || "100%",
          height: initialHeight,
        })
      }
    }
  }, [isFullScreen])

  return (
    <StyledResizableContainer
      className="stDataFrame"
      onBlur={() => {
        // If the container loses focus, clear the current selection
        if (!isFocused) {
          setGridSelection({
            columns: CompactSelection.empty(),
            rows: CompactSelection.empty(),
            current: undefined,
          } as GridSelection)
        }
      }}
    >
      <Resizable
        data-testid="stDataFrameResizable"
        ref={resizableRef}
        defaultSize={resizableSize}
        style={{
          border: `1px solid ${theme.colors.fadedText05}`,
        }}
        minHeight={MIN_TABLE_HEIGHT}
        maxHeight={maxHeight}
        minWidth={MIN_TABLE_WIDTH}
        maxWidth={maxWidth}
        enable={{
          top: false,
          right: false,
          bottom: false,
          left: false,
          topRight: false,
          bottomRight: true,
          bottomLeft: false,
          topLeft: false,
        }}
        grid={[1, ROW_HEIGHT]}
        snapGap={ROW_HEIGHT / 3}
        size={resizableSize}
        onResizeStop={(_event, _direction, _ref, _delta) => {
          if (resizableRef.current) {
            setResizableSize({
              width: resizableRef.current.size.width,
              height:
                // Add an additional pixel if it is stretched to full width
                // to allow the full cell border to be visible
                maxHeight - resizableRef.current.size.height === 3
                  ? resizableRef.current.size.height + 3
                  : resizableRef.current.size.height,
            })
          }
        }}
      >
        <GlideDataEditor
          className="glideDataEditor"
          ref={dataEditorRef}
          columns={columns}
          rows={numRows}
          minColumnWidth={MIN_COLUMN_WIDTH}
          maxColumnWidth={MAX_COLUMN_WIDTH}
          rowHeight={ROW_HEIGHT}
          headerHeight={ROW_HEIGHT}
          getCellContent={getCellContent}
          onColumnResize={onColumnResize}
          // Freeze all index columns:
          freezeColumns={columns.filter(col => (col as Column).isIndex).length}
          smoothScrollX={true}
          // Only deactivate smooth mode for vertical scrolling for large tables:
          smoothScrollY={numRows < 100000}
          // Show borders between cells:
          verticalBorder={true}
          // Activate copy to clipboard functionality:
          getCellsForSelection={true}
          // Deactivate row markers and numbers:
          rowMarkers={"none"}
          // Deactivate selections:
          rangeSelect={"rect"}
          columnSelect={"none"}
          rowSelect={"none"}
          // Activate search:
          keybindings={{ search: true }}
          // Header click is used for column sorting:
          onHeaderClicked={onHeaderClick}
          gridSelection={gridSelection}
          onGridSelectionChange={(newSelection: GridSelection) => {
            setGridSelection(newSelection)
          }}
          theme={createDataFrameTheme(theme)}
          onMouseMove={(args: GridMouseEventArgs) => {
            // Determine if the dataframe is focused or not
            if (args.kind === "out-of-bounds" && isFocused) {
              setIsFocused(false)
            } else if (args.kind !== "out-of-bounds" && !isFocused) {
              setIsFocused(true)
            }
          }}
          experimental={{
            // We use an overlay scrollbar, so no need to have space for reserved for the scrollbar:
            scrollbarWidthOverride: 1,
          }}
          // Add support for additional cells:
          customRenderers={extraCellArgs.customRenderers}
          // Support editing:
          onCellEdited={onCellEdited}
        />
      </Resizable>
    </StyledResizableContainer>
  )
}

export default withFullScreenWrapper(DataFrame)
