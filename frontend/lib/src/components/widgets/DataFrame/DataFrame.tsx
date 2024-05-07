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
  CompactSelection,
  GridMouseEventArgs,
  GridCell,
} from "@glideapps/glide-data-grid"
import { Resizable } from "re-resizable"
import {
  Delete,
  Add,
  FileDownload,
  Search,
  Close,
} from "@emotion-icons/material-outlined"
import isEqual from "lodash/isEqual"

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
// This prevents to rapid updates to the widget state.
const DEBOUNCE_TIME_MS = 150
// Number of rows that triggers some optimization features
// for large tables.
const LARGE_TABLE_ROWS_THRESHOLD = 150000
// The size in px of the customized webkit scrollbar (defined in globalStyles)
const WEBKIT_SCROLLBAR_SIZE = 6

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

  const [gridSelection, setGridSelection] = React.useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
    current: undefined,
  })

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
    // We only want to run this effect once during the initial component load
    // so we disable the eslint rule.
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

  const applySelections = React.useCallback(
    // Use debounce to prevent rapid updates to the widget state.
    debounce(DEBOUNCE_TIME_MS, (newSelection: GridSelection) => {
      // If we want to support selections also with in the editable mode,
      // we would need to integrate the `applyEdits` and `applySelections` functions
      // into a single function that updates the widget state with both the editing
      // state and the selection state.

      const selectionState = {
        // We use snake case here since this is the widget state
        // that is sent and used in the backend. Therefore, it should
        // conform with the Python naming conventions.
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
          return getColumnName(originalColumns[columnIdx])
        })
      const newWidgetState = JSON.stringify(selectionState)
      const currentWidgetState = widgetMgr.getStringValue(
        element as WidgetInfo
      )

      // Only update if there is actually a difference to the previous selection state
      if (
        currentWidgetState === undefined ||
        currentWidgetState !== newWidgetState
      ) {
        widgetMgr.setStringValue(
          element as WidgetInfo,
          newWidgetState,
          {
            fromUi: true,
          },
          fragmentId
        )
      }
    }),
    [widgetMgr, element]
  )

  // This callback is used to clear all selections (row/column/cell)
  const clearSelection = React.useCallback(() => {
    const emptySelection = {
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
      current: undefined,
    }
    setGridSelection(emptySelection)
    applySelections(emptySelection)
  }, [applySelections])

  // This callback is used to clear only cell selections
  const clearCellSelection = React.useCallback(() => {
    setGridSelection({
      columns: gridSelection.columns,
      rows: gridSelection.rows,
      current: undefined,
    })
  }, [gridSelection])

  // This callback is used to refresh the rendering of specified cells
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
  /**
   * This callback should be called after any edits have been applied to the data.
   * It will finish up the editing by updating the number of rows, clearing the selection,
   * and triggering a rerun of the script.
   *
   * @param clearSelections - Whether to clear the selection. This is usually done after deleting rows.
   * @param triggerRerun - Whether to trigger a rerun of the script after applying edits
   */
  const applyEdits = React.useCallback(
    // Use debounce to prevent rapid updates to the widget state.
    debounce(DEBOUNCE_TIME_MS, () => {
      if (numRows !== editingState.current.getNumRows()) {
        // Reset the number of rows if it has been changed in the editing state
        setNumRows(editingState.current.getNumRows())
      }

      const currentEditingState = editingState.current.toJson(columns)
      let currentWidgetState = widgetMgr.getStringValue(element as WidgetInfo)

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
            fromUi: true,
          },
          fragmentId
        )
      }
    }),
    [widgetMgr, element, numRows, clearSelection, columns]
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
      applyEdits,
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
    formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      resetEditingState
    )

    return () => {
      formClearHelper.disconnect()
    }
  }, [element.formId, resetEditingState, widgetMgr])

  const isDynamicAndEditable =
    !isEmptyTable && element.editingMode === DYNAMIC && !disabled

  const isRowSelectionActivated =
    !isEmptyTable &&
    !disabled &&
    (element.selectionMode.includes(ArrowProto.SelectionMode.MULTI_ROW) ||
      element.selectionMode.includes(ArrowProto.SelectionMode.SINGLE_ROW))
  const isMultiRowSelectionActivated =
    isRowSelectionActivated &&
    element.selectionMode.includes(ArrowProto.SelectionMode.MULTI_ROW)

  const isColumnSelectionActivated =
    !isEmptyTable &&
    !disabled &&
    (element.selectionMode.includes(ArrowProto.SelectionMode.SINGLE_COLUMN) ||
      element.selectionMode.includes(ArrowProto.SelectionMode.MULTI_COLUMN))
  const isMultiColumnSelectionActivated =
    isColumnSelectionActivated &&
    element.selectionMode.includes(ArrowProto.SelectionMode.MULTI_COLUMN)

  const isRowSelected = gridSelection.rows.length > 0
  const isColumnSelected = gridSelection.columns.length > 0
  const isCellSelected = gridSelection.current !== undefined

  const freezeColumns = isEmptyTable
    ? 0
    : columns.filter((col: BaseColumn) => col.isIndex).length

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

  React.useEffect(() => {
    // Clear cell selections if fullscreen mode changes
    clearCellSelection()
  }, [isFullScreen])

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
          clearCellSelection()
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
          freezeColumns={freezeColumns}
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
              return undefined
            }
            clearSelection()
            sortColumn(colIndex)
          }}
          gridSelection={gridSelection}
          // We don't have to react to "onSelectionCleared" since
          // we already correctly process selections in
          // the "onGridSelectionChange" callback.
          onGridSelectionChange={(newSelection: GridSelection) => {
            if (isFocused || isTouchDevice) {
              // Only allow selection changes if the grid is focused.
              // This is mainly done because there is a bug when overlay click actions
              // are outside of the bounds of the table (e.g. select dropdown or date picker).
              // This results in the first cell being selected for a short period of time
              // But for touch devices, preventing this can cause issues to select cells.
              // So we allow selection changes for touch devices even when it is not focused.
              const rowSelectionChanged = !isEqual(
                newSelection.rows.toArray(),
                gridSelection.rows.toArray()
              )

              const columnSelectionChanged = !isEqual(
                newSelection.columns.toArray(),
                gridSelection.columns.toArray()
              )

              let updatedSelection = newSelection
              if (
                (isRowSelectionActivated || isColumnSelectionActivated) &&
                newSelection.current !== undefined
              ) {
                // The default behavior is that row selections are cleared when a cell is selected.
                // This is not desired when row selection is activated. Instead, we want to keep the
                // row selection and only update the cell selection.
                updatedSelection = {
                  ...newSelection,
                  rows: gridSelection.rows,
                  columns: gridSelection.columns,
                }
              }

              if (
                rowSelectionChanged &&
                newSelection.rows.length > 0 &&
                columnSelectionChanged &&
                newSelection.columns.length === 0
              ) {
                // Keep the column selection if row selection was changed
                updatedSelection = {
                  ...updatedSelection,
                  columns: gridSelection.columns,
                }
              }
              if (
                columnSelectionChanged &&
                newSelection.columns.length > 0 &&
                rowSelectionChanged &&
                newSelection.rows.length === 0
              ) {
                // Keep the row selection if column selection was changed
                updatedSelection = {
                  ...updatedSelection,
                  rows: gridSelection.rows,
                }
              }

              setGridSelection(updatedSelection)

              if (
                (isRowSelectionActivated && rowSelectionChanged) ||
                (isColumnSelectionActivated && columnSelectionChanged)
              ) {
                applySelections(updatedSelection)
              }

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
            rowSelect: isMultiRowSelectionActivated ? "multi" : "single",
            rowSelectionBlending: "mixed",
            rangeSelectionBlending: "mixed",
          })}
          // Activate features required for column selection:
          {...(isColumnSelectionActivated && {
            columnSelect: isMultiColumnSelectionActivated ? "multi" : "single",
            columnSelectionBlending: "mixed",
            rangeSelectionBlending: "mixed",
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
              rowSelect: "multi",
              // Support adding rows:
              onRowAppended: onRowAppended,
              // Deactivate sorting, since it is not supported with dynamic editing:
              onHeaderClicked: undefined,
            })}
          // Disable some features when the widget is disabled:
          {...(!disabled && {
            rowSelect: "none",
            columnSelect: "none",
            onRowAppended: undefined,
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
