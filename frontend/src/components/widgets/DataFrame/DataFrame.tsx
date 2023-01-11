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
} from "@glideapps/glide-data-grid"
import { useExtraCells } from "@glideapps/glide-data-grid-cells"
import { Resizable } from "re-resizable"

import { FormClearHelper } from "src/components/widgets/Form"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver } from "src/lib/Quiver"
import { Arrow as ArrowProto } from "src/autogen/proto"
import { WidgetInfo, WidgetStateManager } from "src/lib/WidgetStateManager"
import { debounce } from "src/lib/utils"

import EditingState from "./EditingState"
import {
  useCustomTheme,
  useTableSizer,
  useDataLoader,
  useDataEditor,
  useColumnSizer,
  useColumnSort,
} from "./hooks"
import {
  BaseColumn,
  toGlideColumn,
  isMissingValueCell,
  getTextCell,
} from "./columns"
import { StyledResizableContainer } from "./styled-components"

import "@glideapps/glide-data-grid/dist/index.css"
import DatePickerCell from "./customCells/DatePickerCell"
import TimePickerCell from "./customCells/TimePickerCell"
import DatetimeLocalPickerCell from "./customCells/DatetimeLocalPickerCell"

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
const NULL_VALUE_TOKEN = "NA"

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
        // @ts-ignore
        spriteManager: {},
        hyperWrapping: false,
      },
      NULL_VALUE_TOKEN,
      cell.contentAlign
    )
    return true
  }

  return false
}

/**
 * The main component used by dataframe & data_editor to render an editable table.
 *
 * @param element - The element's proto message
 * @param data - The quiver data to render (extracted from the proto message)
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
  const dataEditorRef = React.useRef<DataEditorRef>(null)

  const extraCellArgs = useExtraCells()
  const theme = useCustomTheme()

  const [isFocused, setIsFocused] = React.useState<boolean>(true)

  const [gridSelection, setGridSelection] = React.useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
    current: undefined,
  })

  const clearSelection = React.useCallback(() => {
    setGridSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
      current: undefined,
    })
  }, [])

  // This callback can be used to refresh a selection of cells
  const refreshCells = React.useCallback(
    (
      cells: {
        cell: [number, number]
      }[]
    ) => {
      dataEditorRef.current?.updateCells(cells)
    },
    [] // TODO: add as dependency? https://reactjs.org/docs/hooks-faq.html#how-can-i-measure-a-dom-node
  )
  // Number of rows of the table minus 1 for the header row:
  const originalNumRows = Math.max(0, data.dimensions.rows - 1)
  // For empty tables (editing mode != dynamic), we show an extra row that
  // contains "empty" as a way to indicate that the table is empty.
  const showEmptyState =
    originalNumRows === 0 &&
    element.editingMode !== ArrowProto.EditingMode.DYNAMIC

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

  const { columns: originalColumns, getCellContent: getOriginalCellContent } =
    useDataLoader(element, data, numRows, disabled, editingState)

  const { columns, sortColumn, getOriginalIndex, getCellContent } =
    useColumnSort(originalNumRows, originalColumns, getOriginalCellContent)

  const commitWidgetValue = React.useCallback(
    // Use debounce to prevent rapid updates to the widget state.
    debounce(DEBOUNCE_TIME_MS, () => {
      const currentEditingState = editingState.current.toJson(columns)
      let currentWidgetState = widgetMgr.getStringValue(element as WidgetInfo)

      if (currentWidgetState === undefined) {
        // Create an empty widget state
        currentWidgetState = new EditingState(0).toJson([])
      }

      // Only update if there is actually a difference between editing and widget state
      if (currentEditingState !== currentWidgetState) {
        widgetMgr.setStringValue(element as WidgetInfo, currentEditingState, {
          fromUi: true,
        })
      }
    }),
    [widgetMgr, element]
  )

  const { onCellEdited, onPaste, onRowAppended, onDelete } = useDataEditor(
    numRows,
    columns,
    element.editingMode !== ArrowProto.EditingMode.DYNAMIC,
    getCellContent,
    getOriginalIndex,
    refreshCells,
    commitWidgetValue,
    clearSelection,
    setNumRows,
    editingState
  )

  const { columns: glideColumns, onColumnResize } = useColumnSizer(
    columns.map(column => toGlideColumn(column))
  )

  const resizableRef = React.useRef<Resizable>(null)
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
    resizableRef,
    numRows,
    containerWidth,
    containerHeight,
    isFullScreen
  )

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
    [columns]
  )

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
  }, [])

  return (
    <StyledResizableContainer
      className="stDataFrame"
      onBlur={() => {
        // If the container loses focus, clear the current selection
        if (!isFocused) {
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
          rows={showEmptyState ? 1 : numRows}
          minColumnWidth={MIN_COLUMN_WIDTH}
          maxColumnWidth={MAX_COLUMN_WIDTH}
          maxColumnAutoWidth={MAX_COLUMN_AUTO_WIDTH}
          rowHeight={rowHeight}
          headerHeight={rowHeight}
          getCellContent={
            showEmptyState ? getEmptyStateContent : getCellContent
          }
          onColumnResize={onColumnResize}
          // Freeze all index columns:
          freezeColumns={
            showEmptyState
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
          rangeSelect={"rect"}
          columnSelect={"none"}
          rowSelect={"none"}
          // Activate search:
          keybindings={{ search: true, downFill: true }}
          // Header click is used for column sorting:
          onHeaderClicked={showEmptyState ? undefined : sortColumn}
          gridSelection={gridSelection}
          onGridSelectionChange={setGridSelection}
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
          // onPaste is deactivated in the read-only mode:
          onPaste={false}
          experimental={{
            // We use an overlay scrollbar, so no need to have space for reserved for the scrollbar:
            scrollbarWidthOverride: 1,
          }}
          // Add support for additional cells:
          customRenderers={[
            ...extraCellArgs.customRenderers,
            DatePickerCell,
            TimePickerCell,
            DatetimeLocalPickerCell,
          ]}
          // If element is editable, add additional properties:
          {...(!showEmptyState &&
            element.editingMode !== ArrowProto.EditingMode.READ_ONLY &&
            !disabled && {
              // Support fill handle for bulk editing
              fillHandle: true,
              // Support editing:
              onCellEdited,
              // Support pasting data for bulk editing:
              onPaste,
              // Support deleting cells & rows
              onDelete,
            })}
          {...(element.editingMode === ArrowProto.EditingMode.DYNAMIC && {
            // Support adding rows
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
            // Support adding rows
            onRowAppended: disabled ? undefined : onRowAppended,
            // Deactivate sorting, since it is not supported with dynamic editing
            onHeaderClicked: undefined,
          })}
        />
      </Resizable>
    </StyledResizableContainer>
  )
}

export default withFullScreenWrapper(DataFrame)
