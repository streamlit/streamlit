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
  Item,
} from "@glideapps/glide-data-grid"
import { useColumnSort } from "@glideapps/glide-data-grid-source"
import { useExtraCells } from "@glideapps/glide-data-grid-cells"
import { Resizable, Size as ResizableSize } from "re-resizable"
import { transparentize } from "color2k"
import { useTheme } from "@emotion/react"
import { EmotionIcon } from "@emotion-icons/emotion-icon"

import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver } from "src/lib/Quiver"
import { logError } from "src/lib/log"
import { Theme } from "src/theme"
import { isFromMac, notNullOrUndefined } from "src/lib/utils"
import { Arrow as ArrowProto } from "src/autogen/proto"
import Button, { Kind } from "src/components/shared/Button"
import {
  Search,
  Add,
  Fullscreen,
  FileDownload,
} from "@emotion-icons/material-outlined"
import Icon from "src/components/shared/Icon"
import { debounce } from "src/lib/utils"

import {
  getCellFromQuiver,
  getColumnSortMode,
  getColumnTypeFromQuiver,
  ColumnType,
  getColumnTypeFromConfig,
  CustomColumn,
  getTextCell,
  getErrorCell,
  isEditableType,
  getCell,
  isErrorCell,
  getCellValue,
  getColumnFromQuiver,
  getIndexFromQuiver,
} from "./DataFrameCells"
import {
  StyledResizableContainer,
  StyledDataframeToolbar,
} from "./styled-components"

import "@glideapps/glide-data-grid/dist/index.css"
import { WidgetInfo, WidgetStateManager } from "src/lib/WidgetStateManager"

const ROW_HEIGHT = 35
const MIN_COLUMN_WIDTH = 35
// Max column width used for manual resizing
const MAX_COLUMN_WIDTH = 1000
// Max column width used for automatic column sizing
const MAX_COLUMN_AUTO_WIDTH = 500
// Min width for the resizable table container:
// Based on one column at minimum width + 2 for borders + 1 to prevent overlap problem with selection ring.
const MIN_TABLE_WIDTH = MIN_COLUMN_WIDTH + 3
// Min height for the resizable table container:
// Based on header + one column, and + 2 for borders + 1 to prevent overlap problem with selection ring.
const MIN_TABLE_HEIGHT = 2 * ROW_HEIGHT + 3
const DEFAULT_TABLE_HEIGHT = 400

export interface ActionButtonProps {
  borderless?: boolean
  label?: string
  icon?: EmotionIcon
  onClick: () => void
}

export function ActionButton({
  label,
  icon,
  onClick,
}: ActionButtonProps): ReactElement {
  return (
    <div className="stActionButton">
      <Button onClick={onClick} kind={Kind.ELEMENT_TOOLBAR}>
        {icon && <Icon content={icon} size="md" />}
        {label && <span>{label}</span>}
      </Button>
    </div>
  )
}

export function useEventListener<K extends keyof HTMLElementEventMap>(
  eventName: K,
  handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
  element: HTMLElement | Window | null,
  passive: boolean,
  capture = false
) {
  // Create a ref that stores handler
  const savedHandler =
    React.useRef<(this: HTMLElement, ev: HTMLElementEventMap[K]) => any>()

  // Update ref.current value if handler changes.
  // This allows our effect below to always get latest handler ...
  // ... without us needing to pass it in effect deps array ...
  // ... and potentially cause effect to re-run every render.
  savedHandler.current = handler
  React.useEffect(
    () => {
      // Make sure element supports addEventListener
      if (element === null || element.addEventListener === undefined) return
      const el = element as HTMLElement

      // Create event listener that calls handler function stored in ref
      const eventListener = (event: HTMLElementEventMap[K]) => {
        savedHandler.current?.call(el, event)
      }

      el.addEventListener(eventName, eventListener, { passive, capture })

      // Remove event listener on cleanup
      return () => {
        el.removeEventListener(eventName, eventListener, { capture })
      }
    },
    [eventName, element, passive, capture] // Re-run if eventName or element changes
  )
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
  metadata?: Record<string, unknown>
  alignment?: string
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
    horizontalBorderColor: theme.colors.fadedText05,
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
    textGroupHeader: theme.colors.fadedText60,
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
    // Unused settings:
    // lineHeight
  }
}

/**
 * Apply the column configuration if supplied.
 */
function applyColumnConfig(
  column: CustomColumn,
  columnsConfig: Map<string | number, ColumnConfigProps>
): CustomColumn {
  if (!columnsConfig) {
    // No column config configured
    return column
  }

  let columnConfig
  if (columnsConfig.has(column.title)) {
    columnConfig = columnsConfig.get(column.title)
  } else if (columnsConfig.has(`index:${column.indexNumber}`)) {
    columnConfig = columnsConfig.get(`index:${column.indexNumber}`)
  }

  if (!columnConfig) {
    // No column config found for this column
    return column
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
    // Update hidden state:
    ...(notNullOrUndefined(columnConfig.hidden)
      ? {
          isHidden: columnConfig.hidden,
        }
      : {}),
    // Add column type metadata:
    ...(notNullOrUndefined(columnConfig.metadata)
      ? {
          //TODO(lukasmasuch): Merge in metadata?
          columnTypeMetadata: columnConfig.metadata,
        }
      : {}),
    // Add column alignment:
    ...(notNullOrUndefined(columnConfig.alignment) &&
    ["left", "center", "right"].includes(columnConfig.alignment)
      ? {
          contentAlignment: columnConfig.alignment,
        }
      : {}),
  } as CustomColumn
}

/**
 * Updates the column headers based on the sorting configuration.
 */
function updateSortingHeader(
  columns: CustomColumn[],
  sort: ColumnSortConfig | undefined
): CustomColumn[] {
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

// TODO: Always get state from editing cache
function getCurrentState(
  element: ArrowProto,
  widgetMgr: WidgetStateManager
): any {
  let currentState
  const currentStateString = widgetMgr.getJsonValue(element as WidgetInfo)

  if (currentStateString !== undefined) {
    currentState = JSON.parse(currentStateString)
  }

  if (currentState === undefined) {
    currentState = {
      edits: {},
    }
  }

  if (currentState.edits === undefined) {
    currentState.edits = {}
  }

  return currentState
}

function getColumnConfig(element: ArrowProto): Map<string, any> {
  if (!element.columns) {
    return new Map()
  }
  try {
    return new Map(Object.entries(JSON.parse(element.columns)))
  } catch (error) {
    // This is not expected to happen, but if it does, we'll return an empty map
    // and log the error to the console.
    logError(error)
    return new Map()
  }
}
/**
 * Create return type for useDataLoader hook based on the DataEditorProps.
 */
type DataLoaderReturn = { numRows: number } & Pick<
  DataEditorProps,
  "columns" | "getCellContent" | "onColumnResize" | "onCellEdited" | "onPaste"
>

/**
 * A custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 * And features that influence the data representation and column configuration
 * such as column resizing, sorting, etc.
 */
export function useDataLoader(
  widgetMgr: WidgetStateManager,
  dataEditorRef: React.RefObject<DataEditorRef>,
  element: ArrowProto,
  data: Quiver,
  disabled: boolean,
  sort?: ColumnSortConfig | undefined
): DataLoaderReturn {
  const editingState = React.useRef<EditingState>(new EditingState())
  // The columns with the corresponding empty template for every type:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [columnSizes, setColumnSizes] = useState<Map<string, number>>(
    () => new Map()
  )

  // TODO(lukasmasuch): Use state here for optimization?
  const columnsConfig = getColumnConfig(element)

  /**
   * Returns a list of glide-data-grid compatible columns based on a Quiver instance.
   */
  // TODO(lukasmasuch): Does this need to be a callback?
  const getColumns = React.useCallback((): CustomColumn[] => {
    const columns: CustomColumn[] = []
    const stretchColumn = element.useContainerWidth || element.width

    if (data.isEmpty()) {
      // Tables that don't have any columns cause an exception in glide-data-grid.
      // As a workaround, we are adding an empty index column in this case.
      columns.push({
        id: `empty-index`,
        title: "",
        hasMenu: false,
        columnType: ColumnType.Object,
        indexNumber: 0,
        isEditable: false,
        isIndex: true,
        ...(stretchColumn ? { grow: 1 } : {}),
      } as CustomColumn)
      return columns
    }

    const numIndices = data.types?.index?.length ?? 0
    const numColumns = data.columns?.[0]?.length ?? 0

    for (let i = 0; i < numIndices; i++) {
      const column = {
        ...getIndexFromQuiver(data, i),
        indexNumber: i,
        ...(stretchColumn ? { grow: 1 } : {}),
      } as CustomColumn

      const updatedColumn = applyColumnConfig(column, columnsConfig)
      // TODO(lukasmasuch): Editing for index columns is currently not supported.
      // Deactivate even if it gets activated in the column config.
      updatedColumn.isEditable = false
      columns.push(updatedColumn)
    }

    for (let i = 0; i < numColumns; i++) {
      const column = {
        ...getColumnFromQuiver(data, i),
        indexNumber: i + numIndices,
        ...(stretchColumn ? { grow: 3 } : {}),
      } as CustomColumn
      const updatedColumn = applyColumnConfig(column, columnsConfig)

      // Check if we need to deactivate editing:
      if (
        !element.editable ||
        disabled ||
        !isEditableType(updatedColumn.columnType)
      ) {
        updatedColumn.isEditable = false
      }

      columns.push(updatedColumn)
    }
    return columns
  }, [element, disabled, data, columnsConfig])

  const visibleColumns = getColumns().filter(column => {
    return !column.isHidden
  })

  const sizedColumns = visibleColumns.map(column => {
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
      } as CustomColumn
    }
    return column
  })

  // Number of rows of the table minus 1 for the header row:
  const numRows = data.isEmpty() ? 1 : data.dimensions.rows - 1
  // TODO(lukasmasuch): Remove? const numIndices = data.types?.index?.length ?? 0

  const onColumnResize = React.useCallback(
    (
      column: GridColumn,
      _newSize: number,
      _colIndex: number,
      newSizeWithGrow: number
    ) => {
      if (column.id) {
        setColumnSizes(new Map(columnSizes).set(column.id, newSizeWithGrow))
      }
    },
    [sizedColumns]
  )

  const getCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      if (data.isEmpty()) {
        return {
          ...getTextCell(true, true),
          displayData: "empty",
        } as GridCell
      }

      if (col > sizedColumns.length - 1) {
        return getErrorCell(
          "Column index out of bounds.",
          "This should never happen. Please report this bug."
        )
      }

      if (row > numRows - 1) {
        return getErrorCell(
          "Row index out of bounds.",
          "This should never happen. Please report this bug."
        )
      }

      const column = sizedColumns[col]

      if (column.isEditable) {
        const editedCell = editingState.current.get(column.indexNumber, row)

        if (editedCell !== undefined) {
          return editedCell
        }
      }

      try {
        // Quiver has the header in first row
        const quiverCell = data.getCell(row + 1, column.indexNumber)
        return getCellFromQuiver(column, quiverCell, data.cssStyles)
      } catch (error) {
        // This should not happen in read-only table.
        // TODO(lukasmasuch): What to do with editable table here?
        logError(error)
        return getErrorCell(
          "Error during cell creation.",
          `This should never happen. Please report this bug. \nError: ${error}`
        )
      }
    },
    [sizedColumns, numRows, data, editingState]
  )

  const { getCellContent: getCellContentSorted, getOriginalIndex } =
    useColumnSort({
      columns: sizedColumns,
      getCellContent,
      rows: numRows,
      sort,
    })

  const updatedColumns = updateSortingHeader(sizedColumns, sort)

  const commitValueToState = React.useCallback(
    ([col, row]: readonly [number, number], value: any): void => {
      // TODO(lukasmasuch): Debounce
      const cellPosition = `${col}:${row}`
      const currentState = getCurrentState(element, widgetMgr)
      const currentStateStr = JSON.stringify(currentState)
      currentState.edits[cellPosition] = value

      // only send value if the state was actually changed
      if (JSON.stringify(currentState) !== currentStateStr) {
        widgetMgr.setJsonValue(element as WidgetInfo, currentState, {
          fromUi: true,
        })
      }
    },
    [widgetMgr, element]
  )

  const onCellEdited = React.useCallback(
    (
      [col, row]: readonly [number, number],
      updatedCell: EditableGridCell
    ): void => {
      const column = updatedColumns[col]
      const newCell = getCell(column, getCellValue(column, updatedCell))
      editingState.current.set(column.indexNumber, getOriginalIndex(row), {
        ...newCell,
        lastUpdated: performance.now(),
      })
      commitValueToState(
        [column.indexNumber, getOriginalIndex(row)],
        getCellValue(column, newCell)
      )
    },
    [getOriginalIndex, editingState, updatedColumns, commitValueToState]
  )

  const onPaste = React.useCallback(
    (target: Item, values: readonly (readonly string[])[]): boolean => {
      const [targetCol, targetRow] = target

      const updatedCells: { cell: [number, number] }[] = []

      for (let row = 0; row < values.length; row++) {
        const rowData = values[row]
        if (row + targetRow >= numRows) {
          // TODO(lukasmasuch) Add new rows if necessary
          break
        }
        for (let col = 0; col < rowData.length; col++) {
          const pasteDataValue = rowData[col]

          const rowIndex = row + targetRow
          const colIndex = col + targetCol

          if (colIndex >= updatedColumns.length) {
            // We could potentially add new columns here in the future.
            break
          }

          const column = updatedColumns[colIndex]

          if (!column.isEditable) {
            // Column is not editable -> just ignore
            continue
          }

          const newCell = getCell(column, pasteDataValue)
          if (isErrorCell(newCell)) {
            // If new cell value leads to error -> just ignore
            continue
          }

          editingState.current.set(
            column.indexNumber,
            getOriginalIndex(rowIndex),
            {
              ...newCell,
              lastUpdated: performance.now(),
            }
          )

          updatedCells.push({
            cell: [colIndex, rowIndex],
          })

          // TODO(lukasmasuch): Don't directly update here:
          commitValueToState(
            [column.indexNumber, getOriginalIndex(rowIndex)],
            getCellValue(column, newCell)
          )
        }
        dataEditorRef.current?.updateCells(updatedCells)
      }

      return false
    },
    [
      updatedColumns,
      numRows,
      getOriginalIndex,
      editingState,
      dataEditorRef,
      commitValueToState,
    ]
  )

  return {
    numRows,
    columns: updatedColumns,
    getCellContent: getCellContentSorted,
    onColumnResize,
    onCellEdited,
    onPaste,
  }
}
export interface DataFrameProps {
  element: ArrowProto
  data: Quiver
  width: number
  height?: number
  disabled: boolean
  widgetMgr: WidgetStateManager
  isFullScreen?: boolean
}

function DataFrame({
  element,
  data,
  width: containerWidth,
  height: containerHeight,
  disabled,
  widgetMgr,
  isFullScreen,
}: DataFrameProps): ReactElement {
  const extraCellArgs = useExtraCells()
  const [sort, setSort] = React.useState<ColumnSortConfig>()
  const dataEditorRef = React.useRef<DataEditorRef>(null)
  const theme: Theme = useTheme()

  const stretchColumn = element.useContainerWidth || element.width

  const {
    numRows,
    columns,
    getCellContent,
    onColumnResize,
    onCellEdited,
    onPaste,
  } = useDataLoader(widgetMgr, dataEditorRef, element, data, disabled, sort)
  const [isFocused, setIsFocused] = React.useState<boolean>(true)
  const [showSearch, setShowSearch] = React.useState(false)

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
        mode: getColumnSortMode((clickedColumn as CustomColumn).columnType),
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

  useEventListener(
    "keydown",
    React.useCallback(
      event => {
        if (!isFocused) {
          return
        }

        if (
          event.code === "KeyF" &&
          ((!isFromMac() && event.ctrlKey) || (isFromMac() && event.metaKey))
        ) {
          setShowSearch(cv => !cv)
          event.stopPropagation()
          event.preventDefault()
        }
      },
      [isFocused]
    ),
    window,
    false,
    true
  )

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
      <StyledDataframeToolbar>
        {/* <ActionButton label={"Add Row"} icon={Add} onClick={() => {}} /> */}
        <ActionButton icon={FileDownload} onClick={() => {}} />
        <ActionButton
          icon={Search}
          onClick={() => {
            setIsFocused(true)
            setShowSearch(true)
          }}
        />
        <ActionButton icon={Fullscreen} onClick={() => {}} />
      </StyledDataframeToolbar>
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
          maxColumnAutoWidth={MAX_COLUMN_AUTO_WIDTH}
          rowHeight={ROW_HEIGHT}
          headerHeight={ROW_HEIGHT}
          getCellContent={getCellContent}
          onColumnResize={onColumnResize}
          showSearch={showSearch}
          onSearchClose={() => {
            setShowSearch(false)
          }}
          // Freeze all index columns:
          freezeColumns={
            columns.filter(col => (col as CustomColumn).isIndex).length
          }
          smoothScrollX={true}
          smoothScrollY={true}
          // Show borders between cells:
          verticalBorder={(col: number) =>
            // Show no border for last column in certain situations
            // This is required to prevent the cell selection border to not be cut off
            col >= columns.length &&
            (element.useContainerWidth || resizableSize.width === "100%")
              ? false
              : true
          }
          // Activate copy to clipboard functionality:
          getCellsForSelection={true}
          // Deactivate row markers and numbers:
          rowMarkers={"none"}
          // Deactivate selections:
          rangeSelect={"rect"}
          columnSelect={"none"}
          rowSelect={"none"}
          // Activate search:
          keybindings={{ search: true, downFill: true }}
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
          // Add shadow for index columns and header on scroll:
          fixedShadowX={true}
          fixedShadowY={true}
          onPaste={false}
          experimental={{
            // We use an overlay scrollbar, so no need to have space for reserved for the scrollbar:
            scrollbarWidthOverride: 1,
          }}
          // Add support for additional cells:
          customRenderers={extraCellArgs.customRenderers}
          // If element is editable, add additional properties:
          {...(element.editable &&
            !disabled && {
              // Support editing:
              onCellEdited,
              // Support fill handle for bulk editing
              fillHandle: true,
              // Support on past of bulk editing
              onPaste,
              // Support adding rows
              // trailingRowOptions: {
              //   sticky: true,
              //   tint: true,
              //   // hint: "Add row...",
              // },
              // onRowAppended: () => {},
              // rowMarkers: "checkbox",
              // onDeleteRows: (rows: number[]) => {
              //   console.log("Delete rows", rows)
              // },
              // rowSelect: "multi",
              // rowSelectionMode: "auto",
            })}
        />
      </Resizable>
    </StyledResizableContainer>
  )
}

export default withFullScreenWrapper(DataFrame)
