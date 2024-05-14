/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
  GridMouseEventArgs,
  GridCell,
  Item as GridCellPosition,
  CompactSelection,
} from "@glideapps/glide-data-grid"
import { Resizable } from "re-resizable"
import {
  Delete,
  Add,
  FileDownload,
  Search,
  Close,
} from "@emotion-icons/material-outlined"

import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"
import { Quiver } from "@streamlit/lib/src/dataframes/Quiver"
import { Arrow as ArrowProto } from "@streamlit/lib/src/proto"
import {
  WidgetInfo,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
import { debounce, isNullOrUndefined } from "@streamlit/lib/src/util/utils"
import Toolbar, {
  ToolbarAction,
} from "@streamlit/lib/src/components/shared/Toolbar"

import EditingState, { getColumnName } from "./EditingState"
import {
  useCustomTheme,
  useTableSizer,
  useDataLoader,
  useDataEditor,
  useColumnSizer,
  useColumnSort,
  useColumnLoader,
  useTooltips,
  useCustomRenderer,
  useDataExporter,
  useSelectionHandler,
} from "./hooks"
import {
  BORDER_THRESHOLD,
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  MAX_COLUMN_AUTO_WIDTH,
  ROW_HEIGHT,
} from "./hooks/useTableSizer"
import {
  BaseColumn,
  toGlideColumn,
  getTextCell,
  ImageCellEditor,
} from "./columns"
import Tooltip from "./Tooltip"
import { StyledResizableContainer } from "./styled-components"

import "@glideapps/glide-data-grid/dist/index.css"
import "@glideapps/glide-data-grid-cells/dist/index.css"

// Debounce time for triggering a widget state update
// This prevents rapid updates to the widget state.
const DEBOUNCE_TIME_MS = 150
// Number of rows that triggers some optimization features
// for large tables.
const LARGE_TABLE_ROWS_THRESHOLD = 150000
// The size in px of the customized webkit scrollbar (defined in globalStyles)
const WEBKIT_SCROLLBAR_SIZE = 6

// This is the state that is sent to the backend
// This needs to be the same structure that is also defined
// in the Python code.
export interface DataframeState {
  select: {
    rows: number[]
    // We use column names instead of indices to make
    // it easier to use and unify with how data editor edits
    // are stored.
    columns: string[]
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
  expand?: () => void
  collapse?: () => void
  disableFullscreenMode?: boolean
  fragmentId?: string
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
  disableFullscreenMode,
  expand,
  collapse,
  fragmentId,
}: Readonly<DataFrameProps>): ReactElement {
  const resizableRef = React.useRef<Resizable>(null)
  const dataEditorRef = React.useRef<DataEditorRef>(null)
  const resizableContainerRef = React.useRef<HTMLDivElement>(null)

  const { theme, headerIcons, tableBorderRadius } = useCustomTheme()

  const [isFocused, setIsFocused] = React.useState<boolean>(true)
  const [showSearch, setShowSearch] = React.useState(false)
  const [hasVerticalScroll, setHasVerticalScroll] =
    React.useState<boolean>(false)
  const [hasHorizontalScroll, setHasHorizontalScroll] =
    React.useState<boolean>(false)

  // Determine if the device is primary using touch as input:
  const isTouchDevice = React.useMemo<boolean>(
    () => window.matchMedia && window.matchMedia("(pointer: coarse)").matches,
    []
  )

  // Determine if it uses customized scrollbars (webkit browsers):
  // https://developer.mozilla.org/en-US/docs/Web/CSS/::-webkit-scrollbar#css.selectors.-webkit-scrollbar
  const hasCustomizedScrollbars = React.useMemo<boolean>(
    () =>
      (window.navigator.userAgent.includes("Mac OS") &&
        window.navigator.userAgent.includes("Safari")) ||
      window.navigator.userAgent.includes("Chrome"),
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

  /**
   * On the first rendering, try to load initial widget state if
   * it exists. This is required in the case that other elements
   * are inserted before this widget. In this case, it can happen
   * that the dataframe component is unmounted and thereby loses
   * its state. Once the same element is rendered again, we try to
   * reconstruct the state from the widget manager values.
   */
  React.useEffect(
    () => {
      if (element.editingMode === READ_ONLY) {
        // We don't need to load the initial widget state
        // for read-only dataframes.
        return
      }

      const initialWidgetValue = widgetMgr.getStringValue({
        id: element.id,
        formId: element.formId,
      } as WidgetInfo)

      if (!initialWidgetValue) {
        // No initial widget value was saved in the widget manager.
        // No need to reconstruct something.
        return
      }

      editingState.current.fromJson(initialWidgetValue, originalColumns)
      setNumRows(editingState.current.getNumRows())
    },
    // We only want to run this effect once during the initial component load
    // so we disable the eslint rule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const numIndexColumns = isEmptyTable
    ? 0
    : columns.filter((col: BaseColumn) => col.isIndex).length

  /**
   * This callback is used to synchronize the selection state with the state
   * of the widget state of the component. This might also send a rerun message
   * to the backend if the selection state has changed.
   *
   * @param newSelection - The new selection state
   */
  // The debounce method doesn't allow dependency inspection. Therefore, we
  // need to disable the eslint rule for exhaustive-deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const syncSelectionState = React.useCallback(
    // Use debounce to prevent rapid updates to the widget state.
    debounce(DEBOUNCE_TIME_MS, (newSelection: GridSelection) => {
      // If we want to support selections also with the editable mode,
      // we would need to integrate the `syncEditState` and `syncSelections` functions
      // into a single function that updates the widget state with both the editing
      // state and the selection state.

      const selectionState: DataframeState = {
        select: {
          rows: [] as number[],
          columns: [] as string[],
        },
      }

      selectionState.select.rows = newSelection.rows.toArray().map(row => {
        return getOriginalIndex(row)
      })
      selectionState.select.columns = newSelection.columns
        .toArray()
        .map(columnIdx => {
          return getColumnName(columns[columnIdx])
        })
      const newWidgetState = JSON.stringify(selectionState)
      const currentWidgetState = widgetMgr.getStringValue({
        id: element.id,
        formId: element.formId,
      } as WidgetInfo)

      // Only update if there is actually a difference to the previous selection state
      if (
        currentWidgetState === undefined ||
        currentWidgetState !== newWidgetState
      ) {
        widgetMgr.setStringValue(
          {
            id: element.id,
            formId: element.formId,
          } as WidgetInfo,
          newWidgetState,
          {
            fromUi: true,
          },
          fragmentId
        )
      }
    }),
    [element.id, element.formId, widgetMgr, fragmentId]
  )

  const {
    gridSelection,
    isRowSelectionActivated,
    isMultiRowSelectionActivated,
    isColumnSelectionActivated,
    isMultiColumnSelectionActivated,
    isRowSelected,
    isColumnSelected,
    isCellSelected,
    clearSelection,
    processSelectionChange,
  } = useSelectionHandler(
    element,
    isEmptyTable,
    disabled,
    numIndexColumns,
    syncSelectionState
  )

  React.useEffect(() => {
    // Clear cell selections if fullscreen mode changes
    // but keep row & column selections.
    // In the past we saw some weird side-effects, so we decided to clean
    // it when entering fullscreen-mode. If we decide to change this, we have
    // to play around and get to the bottom of it.
    clearSelection(true, true)
    // Only run this on changes to the fullscreen mode:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullScreen])

  // This callback is used to refresh the rendering of specified cells
  const refreshCells = React.useCallback(
    (
      cells: {
        cell: GridCellPosition
      }[]
    ) => {
      dataEditorRef.current?.updateCells(cells)
    },
    []
  )

  /**
   * On the first rendering, try to load initial selection state
   * from the widget state if it exists. This is required in the
   * case that other elements are inserted before this widget.
   *
   * This effect needs to run after the fullscreen effect that
   * clears cell selections, since both modify the same state object.
   */
  React.useEffect(
    () => {
      if (!isRowSelectionActivated && !isColumnSelectionActivated) {
        // Only run this if selections are activated.
        return
      }

      const initialWidgetValue = widgetMgr.getStringValue({
        id: element.id,
        formId: element.formId,
      } as WidgetInfo)

      if (initialWidgetValue) {
        const columnNames: string[] = columns.map(column => {
          return getColumnName(column)
        })

        const selectionState: DataframeState = JSON.parse(initialWidgetValue)

        let rowSelection = CompactSelection.empty()
        let columnSelection = CompactSelection.empty()

        selectionState.select?.rows?.forEach(row => {
          rowSelection = rowSelection.add(row)
        })

        selectionState.select?.columns?.forEach(column => {
          columnSelection = columnSelection.add(columnNames.indexOf(column))
        })

        if (rowSelection.length > 0 || columnSelection.length > 0) {
          // Update the initial selection state if something was selected
          const initialSelection: GridSelection = {
            rows: rowSelection,
            columns: columnSelection,
            current: undefined,
          }
          processSelectionChange(initialSelection)
        }
      }
    },
    // We only want to run this effect once during the initial component load
    // so we disable the eslint rule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  /**
   * This callback is used to update the number of rows based
   * on the latest editing state. This is required to keep the
   * component state in sync with the editing state.
   */
  const updateNumRows = React.useCallback(() => {
    if (numRows !== editingState.current.getNumRows()) {
      // Reset the number of rows if it has been changed in the editing state
      setNumRows(editingState.current.getNumRows())
    }
  }, [numRows])

  /**
   * This callback is used to synchronize the editing state with
   * the widget state of the component. This might also send a rerun message
   * to the backend if the editing state has changed.
   */
  // The debounce method doesn't allow dependency inspection. Therefore, we
  // need to disable the eslint rule for exhaustive-deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const syncEditState = React.useCallback(
    // Use debounce to prevent rapid updates to the widget state.
    debounce(DEBOUNCE_TIME_MS, () => {
      const currentEditingState = editingState.current.toJson(columns)
      let currentWidgetState = widgetMgr.getStringValue({
        id: element.id,
        formId: element.formId,
      } as WidgetInfo)

      if (currentWidgetState === undefined) {
        // Create an empty widget state
        currentWidgetState = new EditingState(0).toJson([])
      }

      // Only update if there is actually a difference between editing and widget state
      if (currentEditingState !== currentWidgetState) {
        widgetMgr.setStringValue(
          {
            id: element.id,
            formId: element.formId,
          } as WidgetInfo,
          currentEditingState,
          {
            fromUi: true,
          },
          fragmentId
        )
      }
    }),
    [
      element.id,
      element.formId,
      widgetMgr,
      fragmentId,
      columns,
      editingState.current,
    ]
  )

  const { exportToCsv } = useDataExporter(getCellContent, columns, numRows)

  const { onCellEdited, onPaste, onRowAppended, onDelete, validateCell } =
    useDataEditor(
      columns,
      element.editingMode !== DYNAMIC,
      editingState,
      getCellContent,
      getOriginalIndex,
      refreshCells,
      updateNumRows,
      syncEditState,
      clearSelection
    )

  const { tooltip, clearTooltip, onItemHovered } = useTooltips(
    columns,
    getCellContent
  )

  const { drawCell, customRenderers } = useCustomRenderer(columns)

  const transformedColumns = React.useMemo(
    () => columns.map(column => toGlideColumn(column)),
    [columns]
  )
  const { columns: glideColumns, onColumnResize } =
    useColumnSizer(transformedColumns)

  const {
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

  // This is required for the form clearing functionality:
  React.useEffect(() => {
    if (!element.formId) {
      return
    }

    const formClearHelper = new FormClearHelper()
    formClearHelper.manageFormClearListener(widgetMgr, element.formId, () => {
      // Clear the editing state and the selection state
      resetEditingState()
      clearSelection()
    })

    return () => {
      formClearHelper.disconnect()
    }
  }, [element.formId, resetEditingState, clearSelection, widgetMgr])

  const isDynamicAndEditable =
    !isEmptyTable && element.editingMode === DYNAMIC && !disabled

  // Determine if the table requires horizontal or vertical scrolling:
  React.useEffect(() => {
    // The setTimeout is a workaround to get the scroll area bounding box
    // after the grid has been rendered. Otherwise, the scroll area div
    // (dvn-stack) might not have been created yet.
    setTimeout(() => {
      if (resizableContainerRef.current && dataEditorRef.current) {
        // Get the bounds of the glide-data-grid scroll area (dvn-stack):
        const scrollAreaBounds = resizableContainerRef.current
          ?.querySelector(".dvn-stack")
          ?.getBoundingClientRect()

        // We might also be able to use the following as an alternative,
        // but it seems to cause "Maximum update depth exceeded" when scrollbars
        // are activated or deactivated.
        // const scrollAreaBounds = dataEditorRef.current?.getBounds()
        // Also see: https://github.com/glideapps/glide-data-grid/issues/784

        if (scrollAreaBounds) {
          setHasVerticalScroll(
            scrollAreaBounds.height >
              resizableContainerRef.current.clientHeight
          )
          setHasHorizontalScroll(
            scrollAreaBounds.width > resizableContainerRef.current.clientWidth
          )
        }
      }
    }, 1)
  }, [resizableSize, numRows, glideColumns])

  return (
    <StyledResizableContainer
      data-testid="stDataFrame"
      className="stDataFrame"
      hasCustomizedScrollbars={hasCustomizedScrollbars}
      ref={resizableContainerRef}
      onMouseDown={e => {
        if (resizableContainerRef.current && hasCustomizedScrollbars) {
          // Prevent clicks on the scrollbar handle to propagate to the grid:
          const boundingClient =
            resizableContainerRef.current.getBoundingClientRect()

          if (
            // For whatever reason, we are still able to use the scrollbars even
            // if the mouse is one pixel outside of the scrollbar. Therefore, we add
            // an additional pixel.
            hasHorizontalScroll &&
            boundingClient.height - (WEBKIT_SCROLLBAR_SIZE + 1) <
              e.clientY - boundingClient.top
          ) {
            e.stopPropagation()
          }
          if (
            hasVerticalScroll &&
            boundingClient.width - (WEBKIT_SCROLLBAR_SIZE + 1) <
              e.clientX - boundingClient.left
          ) {
            e.stopPropagation()
          }
        }
      }}
      onBlur={event => {
        // If the container loses focus, clear the current selection.
        // Touch screen devices have issues with this, so we don't clear
        // the selection on those devices.
        // We also don't want to clear the selection if the user clicks on
        // on the toolbar by checking that relatedTarget is not a children of
        // this element. Unfortunately, this check isn't working reliably in Safari.
        if (
          !isFocused &&
          !isTouchDevice &&
          !event.currentTarget.contains(
            event.relatedTarget as HTMLElement | null
          )
        ) {
          // Clear cell selections, but keep row & column selections.
          clearSelection(true, true)
        }
      }}
    >
      <Toolbar
        isFullScreen={isFullScreen}
        disableFullscreenMode={disableFullscreenMode}
        // Lock the toolbar in some specific situations:
        locked={
          (isRowSelected && !isRowSelectionActivated) ||
          isCellSelected ||
          (isTouchDevice && isFocused)
        }
        onExpand={expand}
        onCollapse={collapse}
        target={StyledResizableContainer}
      >
        {((isRowSelectionActivated && isRowSelected) ||
          (isColumnSelectionActivated && isColumnSelected)) && (
          // Add clear selection action if selections are active
          // and a valid selections currently exists. Cell selections
          // are not relevant since they are not synced to the backend
          // at the moment.
          <ToolbarAction
            label={"Clear selection"}
            icon={Close}
            onClick={() => {
              clearSelection()
              clearTooltip()
            }}
          />
        )}
        {isDynamicAndEditable && isRowSelected && (
          <ToolbarAction
            label={"Delete row(s)"}
            icon={Delete}
            onClick={() => {
              if (onDelete) {
                onDelete(gridSelection)
                clearTooltip()
              }
            }}
          />
        )}
        {isDynamicAndEditable && !isRowSelected && (
          <ToolbarAction
            label={"Add row"}
            icon={Add}
            onClick={() => {
              if (onRowAppended) {
                setIsFocused(true)
                onRowAppended()
                clearTooltip()
              }
            }}
          />
        )}
        {!isLargeTable && !isEmptyTable && (
          <ToolbarAction
            label={"Download as CSV"}
            icon={FileDownload}
            onClick={() => exportToCsv()}
          />
        )}
        {!isEmptyTable && (
          <ToolbarAction
            label={"Search"}
            icon={Search}
            onClick={() => {
              if (!showSearch) {
                setIsFocused(true)
                setShowSearch(true)
              } else {
                setShowSearch(false)
              }
              clearTooltip()
            }}
          />
        )}
      </Toolbar>
      <Resizable
        data-testid="stDataFrameResizable"
        ref={resizableRef}
        defaultSize={resizableSize}
        style={{
          border: `1px solid ${theme.borderColor}`,
          borderRadius: `${tableBorderRadius}`,
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
        grid={[1, ROW_HEIGHT]}
        snapGap={ROW_HEIGHT / 3}
        onResizeStop={(_event, _direction, _ref, _delta) => {
          if (resizableRef.current) {
            setResizableSize({
              width: resizableRef.current.size.width,
              height:
                // Add additional pixels if it is stretched to full width
                // to allow the full cell border to be visible
                maxHeight - resizableRef.current.size.height ===
                BORDER_THRESHOLD
                  ? resizableRef.current.size.height + BORDER_THRESHOLD
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
          rowHeight={ROW_HEIGHT}
          headerHeight={ROW_HEIGHT}
          getCellContent={isEmptyTable ? getEmptyStateContent : getCellContent}
          onColumnResize={isTouchDevice ? undefined : onColumnResize}
          // Configure resize indicator to only show on the header:
          resizeIndicator={"header"}
          // Freeze all index columns:
          freezeColumns={numIndexColumns}
          smoothScrollX={true}
          smoothScrollY={true}
          // Show borders between cells:
          verticalBorder={true}
          // Activate copy to clipboard functionality:
          getCellsForSelection={true}
          // Deactivate row markers and numbers:
          rowMarkers={"none"}
          // Deactivate selections:
          rangeSelect={isTouchDevice ? "cell" : "rect"}
          columnSelect={"none"}
          rowSelect={"none"}
          // Enable tooltips on hover of a cell or column header:
          onItemHovered={onItemHovered}
          // Activate keybindings:
          keybindings={{ downFill: true }}
          // Search needs to be activated manually, to support search
          // via the toolbar:
          onKeyDown={event => {
            if ((event.ctrlKey || event.metaKey) && event.key === "f") {
              setShowSearch(cv => !cv)
              event.stopPropagation()
              event.preventDefault()
            }
          }}
          showSearch={showSearch}
          onSearchClose={() => {
            setShowSearch(false)
            clearTooltip()
          }}
          // Header click is used for column sorting:
          onHeaderClicked={(colIndex: number, _event) => {
            if (isEmptyTable || isLargeTable || isColumnSelectionActivated) {
              // Deactivate sorting for empty state, for large dataframes, or
              // when column selection is activated.
              return
            }

            if (isRowSelectionActivated && isRowSelected) {
              // Keeping row selections when sorting columns is not supported at the moment.
              // So we need to clear the selection before we do the sorting.
              // The reason is that the user would expect the selection to be kept on
              // the same row after sorting, hover that would require us to map the selection
              // to the new index of the selected row which adds complexity.
              clearSelection()
            }
            sortColumn(colIndex)
          }}
          gridSelection={gridSelection}
          // We don't have to react to "onSelectionCleared" since
          // we already correctly process selections in
          // the "onGridSelectionChange" callback.
          onGridSelectionChange={(newSelection: GridSelection) => {
            // Only allow selection changes if the grid is focused.
            // This is mainly done because there is a bug when overlay click actions
            // are outside of the bounds of the table (e.g. select dropdown or date picker).
            // This results in the first cell being selected for a short period of time
            // But for touch devices, preventing this can cause issues to select cells.
            // So we allow selection changes for touch devices even when it is not focused.
            if (isFocused || isTouchDevice) {
              processSelectionChange(newSelection)
              if (tooltip !== undefined) {
                // Remove the tooltip on every grid selection change:
                clearTooltip()
              }
            }
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
          experimental={{
            // We use overflow scrollbars, so we need to deactivate the native
            // scrollbar override:
            scrollbarWidthOverride: 0,
            ...(hasCustomizedScrollbars && {
              // Add negative padding to the right and bottom to allow the scrollbars in
              // webkit to overlay the table:
              paddingBottom: hasHorizontalScroll
                ? -WEBKIT_SCROLLBAR_SIZE
                : undefined,
              paddingRight: hasVerticalScroll
                ? -WEBKIT_SCROLLBAR_SIZE
                : undefined,
            }),
          }}
          // Apply custom rendering (e.g. for missing or required cells):
          drawCell={drawCell}
          // Add support for additional cells:
          customRenderers={customRenderers}
          // Custom image editor to render single images:
          imageEditorOverride={ImageCellEditor}
          // Add our custom SVG header icons:
          headerIcons={headerIcons}
          // Add support for user input validation:
          validateCell={validateCell}
          // The default setup is read only, and therefore we deactivate paste here:
          onPaste={false}
          // Activate features required for row selection:
          {...(isRowSelectionActivated && {
            rowMarkers: {
              // Apply style settings for the row markers column:
              kind: "checkbox",
              checkboxStyle: "square",
              theme: {
                bgCell: theme.bgHeader,
                bgCellMedium: theme.bgHeader,
              },
            },
            rowSelectionMode: isMultiRowSelectionActivated ? "multi" : "auto",
            rowSelect: disabled
              ? "none"
              : isMultiRowSelectionActivated
              ? "multi"
              : "single",
            rowSelectionBlending: "mixed",
            // Deactivate the combination of row selections
            // and cell selections. This will automatically clear
            // selected cells when a row is selected.
            // We are doing this to prevent some issues with drag
            // and drop selection.
            rangeSelectionBlending: "exclusive",
          })}
          // Activate features required for column selection:
          {...(isColumnSelectionActivated && {
            columnSelect: disabled
              ? "none"
              : isMultiColumnSelectionActivated
              ? "multi"
              : "single",
            columnSelectionBlending: "mixed",
            // Deactivate the combination of column selections
            // and cell selections. This will automatically clear
            // selected cells when a column is selected.
            // We are doing this to prevent some issues with drag
            // and drop selection.
            rangeSelectionBlending: "exclusive",
          })}
          // If element is editable, enable editing features:
          {...(!isEmptyTable &&
            element.editingMode !== READ_ONLY &&
            !disabled && {
              // Support fill handle for bulk editing:
              fillHandle: !isTouchDevice,
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
              rowMarkers: {
                kind: "checkbox",
                checkboxStyle: "square",
                theme: {
                  bgCell: theme.bgHeader,
                  bgCellMedium: theme.bgHeader,
                },
              },
              rowSelectionMode: "multi",
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
          clearTooltip={clearTooltip}
        ></Tooltip>
      )}
    </StyledResizableContainer>
  )
}

export default withFullScreenWrapper(DataFrame, true)
