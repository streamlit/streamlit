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

import React, { ReactElement } from "react"
import {
  DataEditor as GlideDataEditor,
  DataEditorRef,
  GridSelection,
  CompactSelection,
  GridMouseEventArgs,
  drawTextCell,
  DrawCustomCellCallback,
  GridCell,
  SpriteMap,
  EditableGridCell,
  Item,
  ValidatedGridCell,
} from "@glideapps/glide-data-grid"
import { useExtraCells } from "@glideapps/glide-data-grid-cells"
import { Resizable } from "re-resizable"

import { FormClearHelper } from "src/components/widgets/Form"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver } from "src/lib/Quiver"
import { Arrow as ArrowProto } from "src/autogen/proto"
import { WidgetInfo, WidgetStateManager } from "src/lib/WidgetStateManager"
import { debounce, isNullOrUndefined } from "src/lib/utils"
import Tooltip from "./Tooltip"
import EditingState from "./EditingState"
import {
  useCustomTheme,
  useTableSizer,
  useDataLoader,
  useDataEditor,
  useColumnSizer,
  useColumnSort,
  useColumnLoader,
  useTooltips,
} from "./hooks"
import {
  BaseColumn,
  toGlideColumn,
  isMissingValueCell,
  getTextCell,
  CustomCells,
  ImageCellEditor,
} from "./columns"
import { StyledResizableContainer } from "./styled-components"

import "@glideapps/glide-data-grid/dist/index.css"

// Min column width used for manual and automatic resizing
const MIN_COLUMN_WIDTH = 50
// Max column width used for manual resizing
const MAX_COLUMN_WIDTH = 1000
// Max column width used for automatic column sizing
const MAX_COLUMN_AUTO_WIDTH = 500
// Debounce time for triggering a widget state update
// This prevents to rapid updates to the widget state.
const DEBOUNCE_TIME_MS = 100
// Token used for missing values (null, NaN, etc.)
const NULL_VALUE_TOKEN = "None"
// Number of rows that triggers some optimization features
// for large tables.
const LARGE_TABLE_ROWS_THRESHOLD = 150000

export interface DataFrameProps {
  element: ArrowProto
  data: Quiver
  width: number
  height?: number
  disabled: boolean
  widgetMgr: WidgetStateManager
  isFullScreen?: boolean
}

/**
 * If a cell is marked as missing, we draw a placeholder symbol with a faded text color.
 * This is done by providing a custom cell renderer.
 */
const drawMissingCells: DrawCustomCellCallback = args => {
  const { cell, theme } = args
  //, ctx, rect

  if (isMissingValueCell(cell)) {
    drawTextCell(
      {
        ...args,
        theme: {
          ...theme,
          textDark: theme.textLight,
          textMedium: theme.textLight,
        },
        // The following props are just added for technical reasons:
        // @ts-expect-error
        spriteManager: {},
        hyperWrapping: false,
      },
      NULL_VALUE_TOKEN,
      cell.contentAlign
    )

    // TODO: Draw red triangle for required cells (and error cells?)
    // ctx.save()
    // ctx.beginPath()
    // ctx.moveTo(rect.x + rect.width - 8, rect.y + 1)
    // ctx.lineTo(rect.x + rect.width, rect.y + 1)
    // ctx.lineTo(rect.x + rect.width, rect.y + 1 + 8)
    // ctx.fillStyle = theme.accentColor
    // ctx.fill()
    // ctx.restore()
    return true
  }

  return false
}

/**
 * The main component used by dataframe & data_editor to render an editable table.
 *
 * @param element - The element's proto message
 * @param data - The Arrow data to render (extracted from the proto message)
 * @param width - The width of the container
 * @param height - The height of the container
 * @param disabled - Whether the widget is disabled
 * @param widgetMgr - The widget manager
 * @param isFullScreen - Whether the widget is in full screen mode
 */
function DataFrame({
  element,
  data,
  width: containerWidth,
  height: containerHeight,
  disabled,
  widgetMgr,
  isFullScreen,
}: DataFrameProps): ReactElement {
  const resizableRef = React.useRef<Resizable>(null)
  const dataEditorRef = React.useRef<DataEditorRef>(null)

  const extraCellArgs = useExtraCells()
  const theme = useCustomTheme()

  const [isFocused, setIsFocused] = React.useState<boolean>(true)

  const isTouchDevice = React.useMemo<boolean>(
    () => window.matchMedia("(pointer: coarse)").matches,
    []
  )

  const [gridSelection, setGridSelection] = React.useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
    current: undefined,
  })

  const headerIcons = React.useMemo<SpriteMap>(() => {
    return {
      readonly: p => `
        <svg xmlns="http://www.w3.org/2000/svg" height="48" viewBox="0 96 960 960" width="48" fill="${p.bgColor}"><path d="M796 980 500 684 248 936H120V808l252-252L76 260l42-42 720 720-42 42ZM436 620l-22-22 22 22 22 22-22-22Zm148-20-42-42 125-125-44-44-125 125-42-42 168-168 128 128-168 168Zm210-210L666 262l42-42q17-17 42.5-16.5T793 221l43 43q17 17 17.5 41.5T836 348l-42 42ZM520 536ZM180 876h44l234-234-44-44-234 234v44Z"/></svg>`,
      readonly2: p => `
      <svg xmlns="http://www.w3.org/2000/svg" height="40" viewBox="0 96 960 960" width="40" fill="${p.bgColor}"><path d="M258.461 936q-23.91 0-41.186-17.275Q200 901.449 200 877.539V516.41q0-24.308 17.275-41.385 17.276-17.076 41.186-17.076h64.616v-85.026q0-65.57 45.707-111.247Q414.492 216 480.105 216t111.216 45.676q45.602 45.677 45.602 111.247v85.026h64.616q23.91 0 41.186 17.076Q760 492.102 760 516.41v361.129q0 23.91-17.275 41.186Q725.449 936 701.539 936H258.461Zm0-33.846h443.078q10.769 0 17.692-6.923t6.923-17.692V516.41q0-10.769-6.923-17.692t-17.692-6.923H258.461q-10.769 0-17.692 6.923t-6.923 17.692v361.129q0 10.769 6.923 17.692t17.692 6.923ZM480.112 756q24.529 0 41.721-17.136 17.193-17.136 17.193-41.582 0-23.82-17.305-41.577-17.304-17.756-41.833-17.756t-41.721 17.756q-17.193 17.757-17.193 41.91 0 24.154 17.305 41.27Q455.583 756 480.112 756ZM356.923 457.949h246.154v-85.026q0-51.282-35.866-87.18-35.866-35.897-87.102-35.897-51.237 0-87.212 35.897-35.974 35.898-35.974 87.18v85.026ZM233.846 902.154V491.795 902.154Z"/></svg>`,
      editable: p => `
      <svg xmlns="http://www.w3.org/2000/svg" height="40" viewBox="0 96 960 960" width="40" fill="${p.bgColor}"><path d="m800.641 679.743-64.384-64.384 29-29q7.156-6.948 17.642-6.948 10.485 0 17.742 6.948l29 29q6.948 7.464 6.948 17.95 0 10.486-6.948 17.434l-29 29Zm-310.64 246.256v-64.383l210.82-210.821 64.384 64.384-210.821 210.82h-64.383Zm-360-204.872v-50.254h289.743v50.254H130.001Zm0-162.564v-50.255h454.615v50.255H130.001Zm0-162.307v-50.255h454.615v50.255H130.001Z"/></svg>`,
    }
  }, [])

  // This callback is used to clear all selections (row/column/cell)
  const clearSelection = React.useCallback(() => {
    console.log("clearSelection")
    setGridSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
      current: undefined,
    })
  }, [])

  // This callback is used to refresh the rendering of selected cells
  const refreshCells = React.useCallback(
    (
      cells: {
        cell: [number, number]
      }[]
    ) => {
      dataEditorRef.current?.updateCells(cells)
    },
    []
  )

  // This is done to keep some backwards compatibility
  // so that old arrow proto messages from the st.dataframe
  // would still work. Those messages don't have the
  // editingMode field defined.
  if (isNullOrUndefined(element.editingMode)) {
    element.editingMode = ArrowProto.EditingMode.READ_ONLY
  }

  const { READ_ONLY, DYNAMIC } = ArrowProto.EditingMode

  // Number of rows of the table minus 1 for the header row:
  const dataDimensions = data.dimensions
  const originalNumRows = Math.max(0, dataDimensions.rows - 1)

  // For empty tables, we show an extra row that
  // contains "empty" as a way to indicate that the table is empty.
  const isEmptyTable =
    originalNumRows === 0 &&
    // We don't show empty state for dynamic mode with a table that has
    // data columns defined.
    !(element.editingMode === DYNAMIC && dataDimensions.dataColumns > 0)

  // For large tables, we apply some optimizations to handle large data
  const isLargeTable = originalNumRows > LARGE_TABLE_ROWS_THRESHOLD

  const editingState = React.useRef<EditingState>(
    new EditingState(originalNumRows)
  )

  const [numRows, setNumRows] = React.useState(
    editingState.current.getNumRows()
  )

  React.useEffect(() => {
    editingState.current = new EditingState(originalNumRows)
    setNumRows(editingState.current.getNumRows())
  }, [originalNumRows])

  const resetEditingState = React.useCallback(() => {
    editingState.current = new EditingState(originalNumRows)
    setNumRows(editingState.current.getNumRows())
  }, [originalNumRows])

  const { columns: originalColumns } = useColumnLoader(element, data, disabled)

  // On the first rendering, try to load initial widget state if
  // it exist. This is required in the case that other elements
  // are inserted before this widget.
  React.useEffect(
    () => {
      if (element.editingMode !== READ_ONLY) {
        const initialWidgetValue = widgetMgr.getStringValue(element)
        if (initialWidgetValue) {
          editingState.current.fromJson(initialWidgetValue, originalColumns)
          setNumRows(editingState.current.getNumRows())
        }
      }
    },
    // TODO: fix incorrect hook usage. Could misbehave with add_rows so leaving here for now
    /* eslint-disable react-hooks/exhaustive-deps */
    []
  )

  const { getCellContent: getOriginalCellContent } = useDataLoader(
    data,
    originalColumns,
    numRows,
    editingState
  )

  const { columns, sortColumn, getOriginalIndex, getCellContent } =
    useColumnSort(originalNumRows, originalColumns, getOriginalCellContent)

  /**
   * This callback should be called after any edits have been applied to the data.
   * It will finish up the editing by updating the number of rows, clearing the selection,
   * and triggering a rerun of the script.
   *
   * @param clearSelections - Whether to clear the selection. This is usually done after deleting rows.
   * @param triggerRerun - Whether to trigger a rerun of the script after applying edits
   */
  const applyEdits = React.useCallback(
    (clearSelections = false, triggerRerun = true) => {
      if (numRows !== editingState.current.getNumRows()) {
        // Reset the number of rows if it has been changed in the editing state
        setNumRows(editingState.current.getNumRows())
      }

      if (clearSelections) {
        clearSelection()
      }

      // Use debounce to prevent rapid updates to the widget state.
      debounce(DEBOUNCE_TIME_MS, () => {
        const currentEditingState = editingState.current.toJson(columns)
        let currentWidgetState = widgetMgr.getStringValue(
          element as WidgetInfo
        )

        if (currentWidgetState === undefined) {
          // Create an empty widget state
          currentWidgetState = new EditingState(0).toJson([])
        }

        // Only update if there is actually a difference between editing and widget state
        if (currentEditingState !== currentWidgetState) {
          widgetMgr.setStringValue(
            element as WidgetInfo,
            currentEditingState,
            {
              fromUi: triggerRerun,
            }
          )
        }
      })()
    },
    [widgetMgr, element, numRows, clearSelection, columns]
  )

  const { onCellEdited, onPaste, onRowAppended, onDelete } = useDataEditor(
    columns,
    element.editingMode !== DYNAMIC,
    editingState,
    getCellContent,
    getOriginalIndex,
    refreshCells,
    applyEdits
  )

  const { tooltip, clearTooltip, onItemHovered } = useTooltips(
    columns,
    getCellContent
  )

  const { columns: glideColumns, onColumnResize } = useColumnSizer(
    columns.map(column => toGlideColumn(column))
  )

  const {
    rowHeight,
    minHeight,
    maxHeight,
    minWidth,
    maxWidth,
    resizableSize,
    setResizableSize,
  } = useTableSizer(
    element,
    numRows,
    containerWidth,
    containerHeight,
    isFullScreen
  )

  // This is used as fallback in case the table is empty to
  // insert cells indicating this state:
  const getEmptyStateContent = React.useCallback(
    ([_col, _row]: readonly [number, number]): GridCell => {
      return {
        ...getTextCell(true, false),
        displayData: "empty",
        contentAlign: "center",
        allowOverlay: false,
        themeOverride: {
          textDark: theme.textLight,
        },
        span: [0, Math.max(columns.length - 1, 0)],
      } as GridCell
    },
    [columns, theme.textLight]
  )

  const getStyledCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      const gridCell = getCellContent([col, row])
      if (isMissingValueCell(gridCell)) {
        return {
          ...gridCell,
          themeOverride: {
            // bgCell: theme.accentColor,
            borderColor: theme.accentColor,
          },
        }
      }
      return gridCell
    },
    [getCellContent, theme.accentColor]
  )

  // This is required for the form clearing functionality:
  React.useEffect(() => {
    const formClearHelper = new FormClearHelper()
    formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      resetEditingState
    )

    return () => {
      formClearHelper.disconnect()
    }
  }, [element.formId, resetEditingState, widgetMgr])

  return (
    <StyledResizableContainer
      className="stDataFrame"
      onBlur={() => {
        // If the container loses focus, clear the current selection.
        // Touch screen devices have issues with this, so we don't clear
        // the selection on those devices.
        if (!isFocused && !isTouchDevice) {
          clearSelection()
        }
      }}
    >
      <Resizable
        data-testid="stDataFrameResizable"
        ref={resizableRef}
        defaultSize={resizableSize}
        style={{
          border: `1px solid ${theme.borderColor}`,
          borderRadius: `${theme.tableBorderRadius}`,
        }}
        minHeight={minHeight}
        maxHeight={maxHeight}
        minWidth={minWidth}
        maxWidth={maxWidth}
        size={resizableSize}
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
        grid={[1, rowHeight]}
        snapGap={rowHeight / 3}
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
          columns={glideColumns}
          rows={isEmptyTable ? 1 : numRows}
          minColumnWidth={MIN_COLUMN_WIDTH}
          maxColumnWidth={MAX_COLUMN_WIDTH}
          maxColumnAutoWidth={MAX_COLUMN_AUTO_WIDTH}
          rowHeight={rowHeight}
          headerHeight={rowHeight}
          getCellContent={
            isEmptyTable ? getEmptyStateContent : getStyledCellContent
          }
          onColumnResize={onColumnResize}
          // Freeze all index columns:
          freezeColumns={
            isEmptyTable
              ? 0
              : columns.filter((col: BaseColumn) => col.isIndex).length
          }
          smoothScrollX={true}
          smoothScrollY={true}
          // Show borders between cells:
          verticalBorder={(col: number) =>
            // Show no border for last column in certain situations
            // This is required to prevent the cell selection border to not be cut off
            !(
              col >= columns.length &&
              (element.useContainerWidth || resizableSize.width === "100%")
            )
          }
          // Activate copy to clipboard functionality:
          getCellsForSelection={true}
          // Deactivate row markers and numbers:
          rowMarkers={"none"}
          // Deactivate selections:
          rangeSelect={!isTouchDevice ? "rect" : "none"}
          columnSelect={"none"}
          rowSelect={"none"}
          onItemHovered={onItemHovered}
          // Activate search:
          keybindings={{ search: true, downFill: true }}
          // Header click is used for column sorting:
          onHeaderClicked={
            // Deactivate sorting for empty state and for large dataframes:
            isEmptyTable || isLargeTable ? undefined : sortColumn
          }
          gridSelection={gridSelection}
          onGridSelectionChange={(newSelection: GridSelection) => {
            if (isFocused || isTouchDevice) {
              // Only allow selection changes if the grid is focused.
              // This is mainly done because there is a bug when overlay click actions
              // are outside of the bounds of the table (e.g. select dropdown or date picker).
              // This results in the first cell being selected for a short period of time
              // But for touch devices, preventing this can cause issues to select cells.
              // So we allow selection changes for touch devices even when it is not focused.
              setGridSelection(newSelection)
              if (tooltip !== undefined) {
                clearTooltip()
              }
            }
          }}
          // Apply different styling to missing cells:
          drawCell={drawMissingCells}
          theme={theme}
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
          experimental={{
            // We use an overlay scrollbar, so no need to have space for reserved for the scrollbar:
            scrollbarWidthOverride: 1,
          }}
          // Add support for additional cells:
          customRenderers={[...extraCellArgs.customRenderers, ...CustomCells]}
          // Custom single image renderer:
          imageEditorOverride={ImageCellEditor}
          // The default setup is read only, and therefore we deactivate paste here:
          onPaste={false}
          headerIcons={headerIcons}
          validateCell={(cell: Item, newValue: EditableGridCell) => {
            const col = cell[0]
            if (col >= columns.length) {
              return true
            }

            const column = columns[col]
            if (column.validateInput) {
              const validationResult = column.validateInput(
                column.getCellValue(newValue)
              )
              if (validationResult === true || validationResult === false) {
                return validationResult
              }
              return column.getCell(validationResult) as ValidatedGridCell
            }
            return true
          }}
          // If element is editable, enable editing features:
          {...(!isEmptyTable &&
            element.editingMode !== READ_ONLY &&
            !disabled && {
              // Support fill handle for bulk editing:
              fillHandle: !isTouchDevice ? true : false,
              // Support editing:
              onCellEdited,
              // Support pasting data for bulk editing:
              onPaste,
              // Support deleting cells & rows:
              onDelete,
            })}
          // If element is dynamic, enable adding & deleting rows:
          {...(!isEmptyTable &&
            element.editingMode === DYNAMIC && {
              // Support adding rows:
              trailingRowOptions: {
                sticky: false,
                tint: true,
              },
              rowMarkerTheme: {
                bgCell: theme.bgHeader,
                bgCellMedium: theme.bgHeader,
              },
              rowMarkers: "checkbox",
              rowSelectionMode: "auto",
              rowSelect: disabled ? "none" : "multi",
              // Support adding rows:
              onRowAppended: disabled ? undefined : onRowAppended,
              // Deactivate sorting, since it is not supported with dynamic editing:
              onHeaderClicked: undefined,
            })}
        />
      </Resizable>
      {tooltip && tooltip.content && (
        <Tooltip
          top={tooltip.top}
          left={tooltip.left}
          content={tooltip.content}
        ></Tooltip>
      )}
    </StyledResizableContainer>
  )
}

export default withFullScreenWrapper(DataFrame)
