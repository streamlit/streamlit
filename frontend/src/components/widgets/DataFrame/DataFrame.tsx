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
  GridColumn,
  DataEditorRef,
  GridSelection,
  CompactSelection,
  GridMouseEventArgs,
} from "@glideapps/glide-data-grid"
import { useExtraCells } from "@glideapps/glide-data-grid-cells"
import { Resizable } from "re-resizable"

import { FormClearHelper } from "src/components/widgets/Form"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver } from "src/lib/Quiver"
import { Arrow as ArrowProto } from "src/autogen/proto"
import { WidgetInfo, WidgetStateManager } from "src/lib/WidgetStateManager"

import useCustomTheme from "./useCustomTheme"
import useAutoSizer from "./useAutoSizer"
import useDataLoader from "./useDataLoader"
import useDataEditor from "./useDataEditor"
import { CustomColumn } from "./DataFrameCells"
import { StyledResizableContainer } from "./styled-components"

import "@glideapps/glide-data-grid/dist/index.css"

// Min column width used for manual and automatic resizing
const MIN_COLUMN_WIDTH = 35
// Max column width used for manual resizing
const MAX_COLUMN_WIDTH = 1000
// Max column width used for automatic column sizing
const MAX_COLUMN_AUTO_WIDTH = 500

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

  const commitWidgetValue = React.useCallback(
    (currentEditingState: string) => {
      let currentWidgetState = widgetMgr.getStringValue(element as WidgetInfo)

      if (currentWidgetState === undefined) {
        const emptyState = {
          edited_cells: {} as Map<string, any>,
          added_rows: [] as Map<number, any>[],
          deleted_rows: [] as number[],
        }
        currentWidgetState = JSON.stringify(emptyState)
      }

      // Only update if there is actually a difference between editing and widget state
      if (currentEditingState !== currentWidgetState) {
        widgetMgr.setStringValue(element as WidgetInfo, currentEditingState, {
          fromUi: true,
        })
      }
    },
    [widgetMgr, element]
  )

  const {
    numRows: originalNumRows,
    sortColumn,
    getOriginalIndex,
    columns,
    getCellContent: getOriginalCellContent,
    onColumnResize,
  } = useDataLoader(element, data, disabled)

  const {
    numRows,
    resetEditingState,
    getCellContent,
    onCellEdited,
    onPaste,
    onRowAppended,
    onDelete,
  } = useDataEditor(
    originalNumRows,
    columns,
    element.editingMode !== ArrowProto.EditingMode.DYNAMIC,
    getOriginalCellContent,
    getOriginalIndex,
    refreshCells,
    commitWidgetValue,
    clearSelection
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
  } = useAutoSizer(
    element,
    resizableRef,
    numRows,
    containerWidth,
    containerHeight,
    isFullScreen
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
          columns={columns}
          rows={numRows}
          minColumnWidth={MIN_COLUMN_WIDTH}
          maxColumnWidth={MAX_COLUMN_WIDTH}
          maxColumnAutoWidth={MAX_COLUMN_AUTO_WIDTH}
          rowHeight={rowHeight}
          headerHeight={rowHeight}
          getCellContent={getCellContent}
          onColumnResize={onColumnResize}
          // Freeze all index columns:
          freezeColumns={
            columns.filter((col: GridColumn) => (col as CustomColumn).isIndex)
              .length
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
          onHeaderClicked={sortColumn}
          gridSelection={gridSelection}
          onGridSelectionChange={(newSelection: GridSelection) => {
            setGridSelection(newSelection)
          }}
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
          customRenderers={extraCellArgs.customRenderers}
          // If element is editable, add additional properties:
          {...(element.editingMode !== ArrowProto.EditingMode.READ_ONLY &&
            !disabled && {
              // Support fill handle for bulk editing
              fillHandle: true,
              // Support editing:
              onCellEdited: onCellEdited,
              // Support pasting data for bulk editing:
              onPaste: onPaste,
              // Support deleting cells & rows
              onDelete: onDelete,
            })}
          {...(element.editingMode === ArrowProto.EditingMode.DYNAMIC && {
            // Support adding rows
            trailingRowOptions: {
              sticky: false,
              tint: true,
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
