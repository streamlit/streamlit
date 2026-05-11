/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import {
  memo,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  Add,
  Close,
  Delete,
  FileDownload,
  Search,
  Visibility,
} from "@emotion-icons/material-outlined"
import {
  CompactSelection,
  DataEditorRef,
  DataEditor as GlideDataEditor,
  GridCell,
  GridColumn,
  GridMouseEventArgs,
  GridSelection,
  type Item,
  Rectangle,
} from "@glideapps/glide-data-grid"
import { Resizable } from "re-resizable"
import { createPortal } from "react-dom"

import { Dataframe as DataframeProto, streamlit } from "@streamlit/protobuf"

import { FlexContext } from "~lib/components/core/Layout/FlexContext"
import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import withFullScreenWrapper from "~lib/components/shared/FullScreenWrapper/withFullScreenWrapper"
import Toolbar, { ToolbarAction } from "~lib/components/shared/Toolbar/Toolbar"
import { useFormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import { Quiver } from "~lib/dataframes/Quiver"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useDebouncedCallback } from "~lib/hooks/useDebouncedCallback"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { useScrollbarGutterSize } from "~lib/hooks/useScrollbarGutterSize"
import useTimeout from "~lib/hooks/useTimeout"
import { convertRemToPx } from "~lib/theme/utils"
import { isNullOrUndefined } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { getTextCell, ImageCellEditor, toGlideColumn } from "./columns"
import useColumnFormatting from "./hooks/useColumnFormatting"
import useColumnLoader from "./hooks/useColumnLoader"
import useColumnPinning from "./hooks/useColumnPinning"
import useColumnReordering from "./hooks/useColumnReordering"
import useColumnSizer from "./hooks/useColumnSizer"
import useColumnSort from "./hooks/useColumnSort"
import useColumnVisibility from "./hooks/useColumnVisibility"
import useCustomEditors from "./hooks/useCustomEditors"
import useCustomRenderer from "./hooks/useCustomRenderer"
import useCustomTheme from "./hooks/useCustomTheme"
import useDataEditor from "./hooks/useDataEditor"
import useDataExporter from "./hooks/useDataExporter"
import useDataLoader from "./hooks/useDataLoader"
import useRowHover from "./hooks/useRowHover"
import useSelectionHandler from "./hooks/useSelectionHandler"
import useTableSizer from "./hooks/useTableSizer"
import useTooltips from "./hooks/useTooltips"
import useWidgetState, { DEBOUNCE_TIME_MS } from "./hooks/useWidgetState"
import ColumnMenu from "./menus/ColumnMenu"
import ColumnVisibilityMenu from "./menus/ColumnVisibilityMenu"
import { StyledResizableContainer } from "./styled-components"
import Tooltip from "./Tooltip"

import "@glideapps/glide-data-grid/dist/index.css"
import "@glideapps/glide-data-grid-cells/dist/index.css"

// Number of rows that triggers some optimization features
// for large tables.
const LARGE_TABLE_ROWS_THRESHOLD = 150000
// Fallback size for the scrollbar gutter size in rem.
// If the scrollbar gutter size is 0, it means that we the system is using
// overlay scrollbars that don't take any space. In this case, we assume
// a scrollbar size of ~8px to prevent clicks on the scrollbar to be applied
// in the data grid.
const SCROLLBAR_FALLBACK_SIZE_REM = "0.5rem"

export interface DataFrameProps {
  element: DataframeProto
  data: Quiver
  disabled: boolean
  widgetMgr: WidgetStateManager | undefined
  disableFullscreenMode?: boolean
  fragmentId?: string
  // Custom toolbar actions (as React nodes) to display in the grid toolbar.
  customToolbarActions?: React.ReactNode[]
  widthConfig?: streamlit.IWidthConfig | null
  heightConfig?: streamlit.IHeightConfig | null
}

/**
 * The main component used by dataframe & data_editor to render an editable table.
 *
 * @param element - The element's proto message
 * @param data - The Arrow data to render (extracted from the proto message)
 * @param disabled - Whether the widget is disabled
 * @param widgetMgr - The widget manager
 */
function DataFrame({
  element,
  data,
  disabled,
  widgetMgr,
  disableFullscreenMode,
  fragmentId,
  customToolbarActions,
  widthConfig,
  heightConfig,
}: Readonly<DataFrameProps>): ReactElement {
  const {
    expanded: isFullScreen,
    expand,
    collapse,
    width: containerWidth,
    height: fullScreenHeight,
  } = useRequiredContext(ElementFullscreenContext)

  const { isInHorizontalLayout, isInRoot } = useRequiredContext(FlexContext)

  const resizableRef = useRef<Resizable>(null)
  const dataEditorRef = useRef<DataEditorRef>(null)
  // Stores original data row indices that need remapping after a sort operation.
  // Used to preserve row selection in single-row-required mode when columns are sorted.
  const pendingRowSelectionRemapRef = useRef<{
    originalRowIndices: number[]
    columns: CompactSelection
    current: GridSelection["current"]
  } | null>(null)
  const scrollbarGutterSize = useScrollbarGutterSize()

  const {
    height: measuredContainerHeight,
    elementRef: resizableContainerRef,
  } = useCalculatedDimensions()

  const gridTheme = useCustomTheme()

  const { getRowThemeOverride, onItemHovered: handleRowHover } =
    useRowHover(gridTheme)

  // Default to false, if no libConfig, e.g. for tests
  const { enforceDownloadInNewTab = false } = useContext(LibConfigContext)

  const [isFocused, setIsFocused] = useState<boolean>(true)
  const [showSearch, setShowSearch] = useState(false)
  const [hasVerticalScroll, setHasVerticalScroll] = useState<boolean>(false)
  const [hasHorizontalScroll, setHasHorizontalScroll] =
    useState<boolean>(false)
  const [showMenu, setShowMenu] = useState<{
    // The index number of the column that the menu is shown for:
    columnIdx: number
    // The bounds of the column header:
    headerBounds: Rectangle
  }>()
  const [showColumnVisibilityMenu, setShowColumnVisibilityMenu] =
    useState(false)

  const handleToggleColumnVisibilityMenu = useCallback(
    (): void => setShowColumnVisibilityMenu(show => !show),
    []
  )

  const handleCloseColumnVisibilityMenu = useCallback(
    () => setShowColumnVisibilityMenu(false),
    []
  )

  // Determine if the device is primary using touch as input:
  const isTouchDevice = useMemo<boolean>(
    () => window.matchMedia?.("(pointer: coarse)").matches ?? false,
    []
  )

  // This is done to keep some backwards compatibility
  // so that old arrow proto messages from the st.dataframe
  // would still work. Those messages don't have the
  // editingMode field defined.
  const editingMode =
    element.editingMode ?? DataframeProto.EditingMode.READ_ONLY

  const { READ_ONLY, DYNAMIC, ADD_ONLY, DELETE_ONLY } =
    DataframeProto.EditingMode

  // Number of rows of the table minus 1 for the header row:
  const dataDimensions = data.dimensions
  const originalNumRows = Math.max(0, dataDimensions.numDataRows)

  // For empty tables, we show an extra row that
  // contains "empty" as a way to indicate that the table is empty.
  const isEmptyTable =
    originalNumRows === 0 &&
    // We don't show empty state for modes that allow adding rows
    // with a table that has data columns defined.
    !(
      (editingMode === DYNAMIC || editingMode === ADD_ONLY) &&
      dataDimensions.numDataColumns > 0
    )

  // For large tables, we apply some optimizations to handle large data
  const isLargeTable = originalNumRows > LARGE_TABLE_ROWS_THRESHOLD
  // Sorting is disabled for modes that allow adding rows (DYNAMIC, ADD_ONLY)
  // because sorting and row addition can conflict
  const isSortingEnabled =
    !isLargeTable &&
    !isEmptyTable &&
    editingMode !== DYNAMIC &&
    editingMode !== ADD_ONLY

  // Check if the editing mode allows adding rows (DYNAMIC or ADD_ONLY)
  const canAddRows =
    !isEmptyTable &&
    (editingMode === DYNAMIC || editingMode === ADD_ONLY) &&
    !disabled

  // Check if the editing mode allows deleting rows (DYNAMIC or DELETE_ONLY)
  const canDeleteRows =
    !isEmptyTable &&
    (editingMode === DYNAMIC || editingMode === DELETE_ONLY) &&
    !disabled

  const [columnOrder, setColumnOrder] = useState(element.columnOrder)

  // Update the column order if the element.columnOrder value changes
  // e.g. if the user has applied changes to the column order in the code.
  useEffect(() => {
    setColumnOrder(element.columnOrder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.columnOrder.join(",")])

  const {
    columns: originalColumns,
    allColumns,
    setColumnConfigMapping,
  } = useColumnLoader(element, data, disabled, columnOrder, widthConfig)

  // Widget state management hook - handles editing state, syncing with widget manager,
  // and form clear handling
  const {
    editingState,
    numRows,
    updateNumRows,
    syncEditState,
    createSyncSelectionState,
    onFormCleared: handleFormCleared,
    loadInitialSelectionState,
    getProgrammaticSelectionState,
  } = useWidgetState({
    element,
    widgetMgr,
    fragmentId,
    originalNumRows,
    originalColumns,
  })

  const { getCellContent: getOriginalCellContent } = useDataLoader(
    data,
    originalColumns,
    numRows,
    editingState
  )

  const { columns, sortColumn, getOriginalIndex, getCellContent } =
    useColumnSort(originalNumRows, originalColumns, getOriginalCellContent)

  // Ref to access the latest getOriginalIndex in deferred callbacks.
  const getOriginalIndexRef = useRef(getOriginalIndex)
  getOriginalIndexRef.current = getOriginalIndex

  // Ref to track the last processed selectionState to avoid proto mutation.
  // Used to detect when a new programmatic selection arrives from the backend.
  const processedSelectionStateRef = useRef<string | null>(null)

  // Create the sync selection state callback using the sorted columns and getOriginalIndex.
  // This is done here because it needs the output from useColumnSort.
  const innerSyncSelectionState = useMemo(
    () => createSyncSelectionState(columns, getOriginalIndex),
    [createSyncSelectionState, columns, getOriginalIndex]
  )

  // Use a debounce to prevent rapid updates to the widget state.
  const { debouncedCallback: syncSelectionState } = useDebouncedCallback(
    innerSyncSelectionState,
    DEBOUNCE_TIME_MS
  )

  const {
    gridSelection,
    isRowSelectionActivated,
    isMultiRowSelectionActivated,
    isColumnSelectionActivated,
    isMultiColumnSelectionActivated,
    isCellSelectionActivated,
    isMultiCellSelectionActivated,
    isRowSelected,
    isColumnSelected,
    isCellSelected,
    isRequiredRowSelectionActivated,
    clearSelection,
    processSelectionChange,
  } = useSelectionHandler(
    element,
    isEmptyTable,
    disabled,
    columns,
    syncSelectionState
  )

  useEffect(() => {
    if (isCellSelectionActivated) {
      // We don't clear anything if cell selection is activated.
      return
    }
    // Clear cell selections if fullscreen mode changes
    // but keep row & column selections.
    // In the past we saw some weird side-effects, so we decided to clean
    // it when entering fullscreen-mode. If we decide to change this, we have
    // to play around and get to the bottom of it.
    clearSelection(true, true)
    // Only run this on changes to the fullscreen mode:
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: Update to match React best practices
  }, [isFullScreen])

  // This callback is used to refresh the rendering of specified cells
  const refreshCells = useCallback(
    (
      cells: {
        cell: Item
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
  useEffect(
    () => {
      const initialSelection = loadInitialSelectionState({
        columns,
        isRowSelectionActivated,
        isRequiredRowSelectionActivated,
        isColumnSelectionActivated,
        isCellSelectionActivated,
        isMultiCellSelectionActivated,
      })

      if (initialSelection) {
        processSelectionChange(initialSelection, { shouldSync: false })
      }
    },
    // We only want to run this effect once during the initial component load
    // so we disable the eslint rule.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: Update to match React best practices
    []
  )

  /**
   * Remap row selection after sort in single-row-required mode.
   * Scheduled via useTimeout to run after React applies the sort state.
   */
  const performRowSelectionRemap = useCallback(() => {
    if (pendingRowSelectionRemapRef.current === null) {
      return
    }

    const { originalRowIndices, columns, current } =
      pendingRowSelectionRemapRef.current
    pendingRowSelectionRemapRef.current = null

    const currentGetOriginalIndex = getOriginalIndexRef.current

    // Build a Set for O(1) lookup instead of O(n²) nested loops
    const targetOriginalIndices = new Set(originalRowIndices)
    const newDisplayIndices: number[] = []

    for (let displayIdx = 0; displayIdx < originalNumRows; displayIdx++) {
      const origIdx = currentGetOriginalIndex(displayIdx)
      if (targetOriginalIndices.has(origIdx)) {
        newDisplayIndices.push(displayIdx)
        // Early exit when all targets found
        if (newDisplayIndices.length === targetOriginalIndices.size) {
          break
        }
      }
    }

    if (newDisplayIndices.length > 0) {
      const newSelection: GridSelection = {
        columns,
        rows: CompactSelection.fromSingleSelection(newDisplayIndices[0]),
        current,
      }
      processSelectionChange(newSelection)
    }
  }, [originalNumRows, processSelectionChange])

  /**
   * Schedule row selection remapping after sort. The 0ms delay ensures
   * the remap runs after React applies the sort state changes.
   */
  const { restart: scheduleRowSelectionRemap } = useTimeout(
    performRowSelectionRemap,
    0,
    { autoStart: false }
  )

  /**
   * Apply programmatic selection changes set via st.session_state.
   * selectionState is a one-shot signal from the backend (only present on
   * the rerun where the value changed). We track processed values via ref
   * to avoid mutating the proto object.
   */
  useEffect(() => {
    // Skip if no selectionState or we've already processed this exact value
    if (
      !element.selectionState ||
      element.selectionState === processedSelectionStateRef.current
    ) {
      return
    }

    const selectionState = element.selectionState
    // Mark as processed (using ref instead of proto mutation)
    processedSelectionStateRef.current = selectionState

    const programmaticSelection = getProgrammaticSelectionState({
      selectionState,
      columns,
      isRowSelectionActivated,
      isColumnSelectionActivated,
      isCellSelectionActivated,
      isMultiCellSelectionActivated,
      getOriginalIndex,
    })

    if (programmaticSelection) {
      processSelectionChange(programmaticSelection, { shouldSync: false })
    }
  }, [
    element.selectionState,
    columns,
    isRowSelectionActivated,
    isColumnSelectionActivated,
    isCellSelectionActivated,
    isMultiCellSelectionActivated,
    getProgrammaticSelectionState,
    processSelectionChange,
    getOriginalIndex,
  ])

  const { exportToCsv } = useDataExporter(
    getCellContent,
    columns,
    numRows,
    enforceDownloadInNewTab
  )

  const { onCellEdited, onPaste, onRowAppended, onDelete, validateCell } =
    useDataEditor({
      columns,
      allColumns,
      canAddRows,
      canDeleteRows,
      editingState,
      getCellContent,
      getOriginalIndex,
      refreshCells,
      updateNumRows,
      syncEditState,
      clearSelection,
    })

  const ignoredRowIndices = useMemo(() => {
    // If empty table, ignore row index 0 which is just a visual gimmick
    // If row adding is enabled, we need to ignore the last row (trailing row)
    // because it would result in some undesired errors in the tooltips.
    // The index are 0-based -> therefore, numRows will point to the trailing row
    // (which is not part of the actual data).
    if (isEmptyTable) {
      return [0]
    }
    if (canAddRows) {
      return [numRows]
    }
    return []
  }, [isEmptyTable, canAddRows, numRows])

  const {
    tooltip,
    clearTooltip,
    onItemHovered: handleTooltips,
  } = useTooltips(columns, getCellContent, ignoredRowIndices)

  const { drawCell, customRenderers } = useCustomRenderer(
    columns,
    element.placeholder ?? undefined
  )
  const { provideEditor } = useCustomEditors()
  // Callback that can be used to configure the column menu for the columns
  const configureColumnMenu = useCallback(
    (column: GridColumn): GridColumn => {
      return {
        ...column,
        hasMenu: !isEmptyTable,
      }
    },
    [isEmptyTable]
  )

  // Convert columns from our structure into the glide-data-grid compatible structure
  const transformedColumns = useMemo(
    () => columns.map(column => configureColumnMenu(toGlideColumn(column))),
    [columns, configureColumnMenu]
  )
  const { columns: glideColumns, onColumnResize } =
    useColumnSizer(transformedColumns)

  // To activate the group row feature (multi-level headers),
  // we need more than one header row.
  const usesGroupRow = data.dimensions.numHeaderRows > 1
  const {
    minHeight,
    maxHeight,
    minWidth,
    maxWidth,
    rowHeight,
    resizableSize,
    setResizableSize,
  } = useTableSizer(
    element,
    gridTheme,
    numRows,
    usesGroupRow,
    containerWidth || 0,
    fullScreenHeight,
    isFullScreen,
    widthConfig,
    heightConfig,
    measuredContainerHeight,
    isInRoot
  )
  // This is used as fallback in case the table is empty to
  // insert cells indicating this state:
  const getEmptyStateContent = useCallback(
    ([_col, _row]: readonly [number, number]): GridCell => {
      return {
        ...getTextCell(true, false),
        displayData: "empty",
        contentAlign: "center",
        allowOverlay: false,
        themeOverride: {
          textDark: gridTheme.glideTheme.textLight,
        },
        span: [0, Math.max(columns.length - 1, 0)],
      }
    },
    [columns, gridTheme.glideTheme.textLight]
  )

  const onFormCleared = useCallback(() => {
    // Clear the editing state and the selection state
    handleFormCleared()
    clearSelection()
  }, [handleFormCleared, clearSelection])

  useFormClearHelper({ element, widgetMgr, onFormCleared })

  const { pinColumn, unpinColumn, freezeColumns } = useColumnPinning(
    columns,
    isEmptyTable,
    containerWidth || 0,
    gridTheme.minColumnWidth,
    clearSelection,
    setColumnConfigMapping
  )
  const { changeColumnFormat } = useColumnFormatting(setColumnConfigMapping)
  const { hideColumn, showColumn } = useColumnVisibility(
    clearSelection,
    setColumnConfigMapping
  )
  const { onColumnMoved } = useColumnReordering(
    columns,
    freezeColumns,
    pinColumn,
    unpinColumn,
    setColumnOrder
  )

  const measureTableScrollbars = useCallback(() => {
    if (resizableContainerRef.current && dataEditorRef.current) {
      // Get the bounds of the glide-data-grid scroll area (dvn-stack):
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
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
            // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
            resizableContainerRef.current.clientHeight
        )
        setHasHorizontalScroll(
          scrollAreaBounds.width >
            // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
            resizableContainerRef.current.clientWidth
        )
      }
    }
  }, [dataEditorRef, resizableContainerRef])

  const {
    clear: clearMeasureTableScrollbarsTimeout,
    restart: restartMeasureTableScrollbarsTimeout,
  } = useTimeout(measureTableScrollbars, 0, { autoStart: false })

  const remeasureColumnIdxRef = useRef<number | null>(null)
  const { restart: restartDelayedColumnRemeasure } = useTimeout(
    () => {
      if (isNullOrUndefined(remeasureColumnIdxRef.current)) {
        return
      }

      dataEditorRef.current?.remeasureColumns(
        CompactSelection.fromSingleSelection(remeasureColumnIdxRef.current)
      )
      remeasureColumnIdxRef.current = null
    },
    100,
    { autoStart: false }
  )

  // Determine if the table requires horizontal or vertical scrolling:
  useEffect(() => {
    // Use requestAnimationFrame + setTimeout to ensure the DOM is fully rendered
    // before measuring. This is more reliable than setTimeout alone.
    // requestAnimationFrame ensures the browser has calculated layout,
    // and setTimeout pushes the callback to the next event loop tick.
    const rafId = requestAnimationFrame(() => {
      restartMeasureTableScrollbarsTimeout()
    })

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(rafId)
      clearMeasureTableScrollbarsTimeout()
    }
  }, [
    clearMeasureTableScrollbarsTimeout,
    glideColumns,
    numRows,
    resizableContainerRef,
    resizableSize,
    restartMeasureTableScrollbarsTimeout,
  ])

  // Disable resize if the dataframe is in a horizontal layout or if it is a content-width dataframe
  // and not in the root container. This is because the feature requires measurements from the parent container
  // which cannot be determined when the parent container has a fit-content width or when there are multiple siblings
  // in a nested container.
  const disableResize =
    isInHorizontalLayout || (widthConfig?.useContent && !isInRoot)
      ? true
      : false

  return (
    <StyledResizableContainer
      className="stDataFrame"
      data-testid="stDataFrame"
      ref={resizableContainerRef}
      isInHorizontalLayout={isInHorizontalLayout}
      minHeight={minHeight}
      disableResize={disableResize}
      onPointerDown={e => {
        if (resizableContainerRef.current) {
          // Prevent clicks on the scrollbar handle to propagate to the grid:
          const boundingClient =
            // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
            resizableContainerRef.current.getBoundingClientRect()

          // For whatever reason, we are still able to use the scrollbars even
          // if the mouse is one pixel outside of the scrollbar. Therefore, we add
          // an additional pixel.
          const scrollbarSize =
            (scrollbarGutterSize ||
              Math.round(convertRemToPx(SCROLLBAR_FALLBACK_SIZE_REM))) + 1

          if (
            hasHorizontalScroll &&
            boundingClient.height - scrollbarSize <
              e.clientY - boundingClient.top
          ) {
            e.stopPropagation()
          }
          if (
            hasVerticalScroll &&
            boundingClient.width - scrollbarSize <
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
          !event.currentTarget.contains(event.relatedTarget) &&
          !isCellSelectionActivated
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
          (isTouchDevice && isFocused) ||
          showColumnVisibilityMenu
        }
        onExpand={expand}
        onCollapse={collapse}
        target={StyledResizableContainer}
      >
        {customToolbarActions?.map(action => action)}
        {((isRowSelectionActivated &&
          isRowSelected &&
          !isRequiredRowSelectionActivated) ||
          (isColumnSelectionActivated && isColumnSelected) ||
          (isCellSelectionActivated && isCellSelected)) && (
          // Add clear selection action if selections are active
          // and a valid selections currently exists. Cell selections
          // are not relevant since they are not synced to the backend
          // at the moment. Hide for single-row-required mode since
          // clearing is not allowed.
          <ToolbarAction
            label="Clear selection"
            icon={Close}
            onClick={() => {
              clearSelection()
              clearTooltip()
            }}
          />
        )}
        {canDeleteRows && isRowSelected && (
          <ToolbarAction
            label="Delete row(s)"
            icon={Delete}
            onClick={() => {
              if (onDelete) {
                onDelete(gridSelection)
                clearTooltip()
              }
            }}
          />
        )}
        {canAddRows && !isRowSelected && (
          <ToolbarAction
            label="Add row"
            icon={Add}
            onClick={() => {
              if (onRowAppended) {
                setIsFocused(true)
                // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
                onRowAppended()
                clearTooltip()
                // Automatically scroll to the new row on the vertical axis:
                dataEditorRef.current?.scrollTo(0, numRows, "vertical")
              }
            }}
          />
        )}
        {!isEmptyTable && allColumns.length > 0 && (
          <ColumnVisibilityMenu
            columns={allColumns}
            columnOrder={columnOrder}
            setColumnOrder={setColumnOrder}
            hideColumn={hideColumn}
            showColumn={showColumn}
            isOpen={showColumnVisibilityMenu}
            onClose={handleCloseColumnVisibilityMenu}
          >
            <ToolbarAction
              label="Show/hide columns"
              icon={Visibility}
              onClick={handleToggleColumnVisibilityMenu}
            />
          </ColumnVisibilityMenu>
        )}
        {!isLargeTable && !isEmptyTable && (
          <ToolbarAction
            label="Download as CSV"
            icon={FileDownload}
            onClick={exportToCsv}
          />
        )}
        {!isEmptyTable && (
          <ToolbarAction
            label="Search"
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
          border: `${gridTheme.tableBorderWidth}px solid ${gridTheme.glideTheme.borderColor}`,
          borderRadius: `${gridTheme.tableBorderRadius}`,
        }}
        minHeight={minHeight}
        maxHeight={maxHeight}
        minWidth={minWidth}
        // The maxWidth is not calculated correctly for content width
        // dataframes in horizontal layouts, so it is disabled. The
        // resize handles are also disabled so that the dataframe cannot be
        // stretched beyond the container width.
        maxWidth={disableResize ? undefined : maxWidth}
        size={resizableSize}
        enable={{
          top: false,
          right: false,
          bottom: false,
          left: false,
          topRight: false,
          bottomRight: disableResize ? false : true,
          bottomLeft: false,
          topLeft: false,
        }}
        grid={[1, rowHeight]}
        snapGap={rowHeight / 3}
        onResizeStop={(_event, _direction, _ref, _delta) => {
          if (resizableRef.current) {
            const borderThreshold = 2 * gridTheme.tableBorderWidth
            setResizableSize({
              width: resizableRef.current.size.width,
              height:
                // Add additional pixels if it is stretched to full width
                // to allow the full cell border to be visible
                maxHeight - resizableRef.current.size.height ===
                borderThreshold
                  ? resizableRef.current.size.height + borderThreshold
                  : resizableRef.current.size.height,
            })
          }
        }}
      >
        <GlideDataEditor
          // The className is used in styled components:
          className="stDataFrameGlideDataEditor"
          data-testid="stDataFrameGlideDataEditor"
          ref={dataEditorRef}
          columns={glideColumns}
          rows={isEmptyTable ? 1 : numRows}
          minColumnWidth={gridTheme.minColumnWidth}
          maxColumnWidth={gridTheme.maxColumnWidth}
          maxColumnAutoWidth={gridTheme.maxColumnAutoWidth}
          rowHeight={rowHeight}
          headerHeight={gridTheme.defaultHeaderHeight}
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
          // Enable interactive column reordering:
          onColumnMoved={
            // Column selection is not compatible with column reordering.
            isColumnSelectionActivated ? undefined : onColumnMoved
          }
          // Enable tooltips and row hovering theme on hover of a cell or column header:
          onItemHovered={(args: GridMouseEventArgs) => {
            handleRowHover?.(args)
            handleTooltips?.(args)
          }}
          // Activate keybindings:
          keybindings={{
            downFill: true,
            ...(isCellSelectionActivated || isLargeTable
              ? {
                  // Deactivate select all to prevent potential performance issues
                  // with too many selected cells being processed for cell selection:
                  selectAll: false,
                }
              : {}),
          }}
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
          searchResults={!showSearch ? [] : undefined}
          onSearchClose={() => {
            setShowSearch(false)
            clearTooltip()
          }}
          // Header click is used for column sorting:
          onHeaderClicked={(columnIdx: number, _event) => {
            if (!isSortingEnabled || isColumnSelectionActivated) {
              // Deactivate sorting for empty state, for large dataframes, or
              // when column selection is activated.
              return
            }

            // Hide search before sorting to clear search results
            if (showSearch) {
              setShowSearch(false)
            }

            if (isRequiredRowSelectionActivated && isRowSelected) {
              // In single-row-required mode, preserve the row selection by remapping
              // it to the same data row after sort. Capture the original data indices
              // and current column selection before sorting.
              const originalRowIndices = gridSelection.rows
                .toArray()
                .map(getOriginalIndex)
              pendingRowSelectionRemapRef.current = {
                originalRowIndices,
                columns: gridSelection.columns,
                // Don't capture current cell selection - it uses display coordinates
                // that become stale after sorting
                current: undefined,
              }
              // Clear cell selections but keep row and column selections
              clearSelection(true, true)
            } else if (isRowSelectionActivated && isRowSelected) {
              // For other row selection modes, clear the selection before sorting.
              // Keeping row selections when sorting columns is not supported at the moment.
              clearSelection()
            } else {
              // Cell selections are kept on the old position,
              // which can be confusing. So we clear all cell selections before sorting.
              clearSelection(true, true)
            }

            sortColumn(columnIdx, "auto")
            // Schedule remap after sorting (ref was just set above)
            if (isRequiredRowSelectionActivated && isRowSelected) {
              scheduleRowSelectionRemap()
            }
          }}
          gridSelection={gridSelection}
          // We don't have to react to "onSelectionCleared" since
          // we already correctly process selections in
          // the "onGridSelectionChange" callback.
          onGridSelectionChange={(newSelection: GridSelection) => {
            // Guard against spurious cell selections from overlay clicks outside
            // the table bounds. Row/column selections are always allowed because
            // isFocused may be stale when the user clicks back into the grid.
            // Touch devices bypass the guard entirely.
            const hasRowOrColumnSelection =
              newSelection.rows.length > 0 || newSelection.columns.length > 0
            if (isFocused || isTouchDevice || hasRowOrColumnSelection) {
              processSelectionChange(newSelection)
              if (tooltip !== undefined) {
                // Remove the tooltip on every grid selection change:
                clearTooltip()
              }
              // Close menus:
              setShowMenu(undefined)
              setShowColumnVisibilityMenu(false)
            }
          }}
          theme={gridTheme.glideTheme}
          getRowThemeOverride={getRowThemeOverride}
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
            // Deactivate the native scrollbar override to optimize our
            // scrollbars to always behave like overlay scrollbars.
            scrollbarWidthOverride: 0,
            // Add negative padding to the right and bottom to allow the scrollbars
            // to overlay the table:
            paddingBottom: hasHorizontalScroll
              ? -scrollbarGutterSize
              : undefined,
            paddingRight: hasVerticalScroll ? -scrollbarGutterSize : undefined,
          }}
          provideEditor={provideEditor}
          // Apply custom rendering (e.g. for missing or required cells):
          drawCell={drawCell}
          // Add support for additional cells:
          customRenderers={customRenderers}
          // Custom image editor to render single images:
          imageEditorOverride={ImageCellEditor}
          // Add our custom SVG header icons:
          headerIcons={gridTheme.headerIcons}
          // Add support for user input validation:
          validateCell={validateCell}
          // Open column context menu:
          onHeaderMenuClick={(columnIdx, screenPosition) => {
            // There is an issue that clicking on the column visibility menu
            // can trigger a menu click event on the column header.
            // To prevent another menu from opening, we check if column
            // visibility menu open state.
            // https://github.com/streamlit/streamlit/pull/12233
            if (!showColumnVisibilityMenu) {
              setShowMenu({
                columnIdx,
                headerBounds: screenPosition,
              })
            }
          }}
          // The default setup is read only, and therefore we deactivate paste here:
          onPaste={false}
          // Activate features required for row selection:
          {...(isRowSelectionActivated && {
            rowMarkers: {
              // Apply style settings for the row markers column:
              kind: "checkbox-visible",
              // Use circle style for single-row-required mode (radio-like behavior)
              checkboxStyle: isRequiredRowSelectionActivated
                ? "circle"
                : "square",
              theme: {
                bgCell: gridTheme.glideTheme.bgHeader,
                bgCellMedium: gridTheme.glideTheme.bgHeader,
                // Use a lighter color for the checkboxes in the row markers column,
                // otherwise its a bit too prominent:
                textMedium: gridTheme.glideTheme.textLight,
              },
            },
            rowSelectionMode: isMultiRowSelectionActivated ? "multi" : "auto",
            rowSelect: disabled
              ? "none"
              : isMultiRowSelectionActivated
                ? "multi"
                : "single",
            rowSelectionBlending: "additive",
            rangeSelectionBlending: "additive",
          })}
          // Activate features required for column selection:
          {...(isColumnSelectionActivated && {
            columnSelect: disabled
              ? "none"
              : isMultiColumnSelectionActivated
                ? "multi"
                : "single",
            columnSelectionBlending: "additive",
            columnSelectionMode: isMultiColumnSelectionActivated
              ? "multi"
              : "auto",
            rangeSelectionBlending: "additive",
          })}
          // Activate features required for cell selection:
          {...(isCellSelectionActivated && {
            rangeSelect: isMultiCellSelectionActivated ? "rect" : "cell",
            // Allow mixing cell selections with row and column selections:
            rangeSelectionBlending: "additive",
          })}
          // If element is editable, enable editing features:
          {...(!isEmptyTable &&
            editingMode !== READ_ONLY &&
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
          // If element allows adding rows (DYNAMIC or ADD_ONLY), enable trailing row
          // and deactivate sorting:
          {...(canAddRows && {
            trailingRowOptions: {
              sticky: false,
              tint: true,
            },
            onRowAppended,
            // Deactivate sorting for modes that allow adding rows:
            onHeaderClicked: undefined,
          })}
          // If element allows deleting rows (DYNAMIC or DELETE_ONLY), enable row selection:
          {...(canDeleteRows && {
            rowMarkers: {
              kind: "checkbox",
              checkboxStyle: "square",
              theme: {
                bgCell: gridTheme.glideTheme.bgHeader,
                bgCellMedium: gridTheme.glideTheme.bgHeader,
              },
            },
            rowSelectionMode: "multi",
            rowSelect: disabled ? "none" : "multi",
          })}
        />
      </Resizable>
      {tooltip?.content && (
        <Tooltip
          top={tooltip.top}
          left={tooltip.left}
          content={tooltip.content}
          clearTooltip={clearTooltip}
        ></Tooltip>
      )}
      {showMenu &&
        createPortal(
          // A context menu that provides interactive features (sorting, pinning, show/hide)
          // for a grid column.
          <ColumnMenu
            top={showMenu.headerBounds.y + showMenu.headerBounds.height}
            left={showMenu.headerBounds.x + showMenu.headerBounds.width}
            column={originalColumns[showMenu.columnIdx]}
            onCloseMenu={() => setShowMenu(undefined)}
            onSortColumn={
              isSortingEnabled
                ? (direction: "asc" | "desc" | undefined) => {
                    // Hide search before sorting to clear search results
                    if (showSearch) {
                      setShowSearch(false)
                    }

                    if (isRequiredRowSelectionActivated && isRowSelected) {
                      // In single-row-required mode, preserve the row selection by remapping
                      // it to the same data row after sort. Capture the original data indices
                      // and current column selection before sorting.
                      const originalRowIndices = gridSelection.rows
                        .toArray()
                        .map(getOriginalIndex)
                      pendingRowSelectionRemapRef.current = {
                        originalRowIndices,
                        columns: gridSelection.columns,
                        // Don't capture current cell selection - it uses display coordinates
                        // that become stale after sorting
                        current: undefined,
                      }
                      // Clear cell selections but keep row and column selections
                      clearSelection(true, true)
                    } else if (isRowSelectionActivated && isRowSelected) {
                      // For other row selection modes, clear the selection before sorting.
                      // Keeping row selections when sorting columns is not supported at the moment.
                      // So we need to clear the selected rows before we do the sorting (Issue #11345).
                      // Maintain column selections as these are not impacted.
                      clearSelection(false, true)
                    } else {
                      // Cell selection are kept on the old position,
                      // which can be confusing. So we clear all cell selections before sorting.
                      clearSelection(true, true)
                    }

                    sortColumn(showMenu.columnIdx, direction, true)
                    // Schedule remap after sorting (ref was just set above)
                    if (isRequiredRowSelectionActivated && isRowSelected) {
                      scheduleRowSelectionRemap()
                    }
                  }
                : undefined
            }
            isColumnPinned={originalColumns[showMenu.columnIdx].isPinned}
            onUnpinColumn={() => {
              unpinColumn(originalColumns[showMenu.columnIdx].id)
            }}
            onPinColumn={() => {
              pinColumn(originalColumns[showMenu.columnIdx].id)
            }}
            onHideColumn={() => {
              hideColumn(originalColumns[showMenu.columnIdx].id)
            }}
            onChangeFormat={(format: string) => {
              changeColumnFormat(
                originalColumns[showMenu.columnIdx].id,
                format
              )
              // After changing the format, remeasure the column to ensure that
              // the column width is updated to the new format.
              // We need to apply a short timeout here to ensure that
              // the column format already has been fully applied to all cells
              // before we remeasure the column.
              remeasureColumnIdxRef.current = showMenu.columnIdx
              restartDelayedColumnRemeasure()
            }}
            onAutosize={() => {
              dataEditorRef.current?.remeasureColumns(
                CompactSelection.fromSingleSelection(showMenu.columnIdx)
              )
            }}
          />,
          // We put the column menu into the portal element which is also
          // used for the cell overlays. This allows us to correctly position
          // the column menu also when the grid is used in a dialog, popover,
          // or anything else that apply a transform (position fixed is influenced
          // by the transform property of the parent element).
          // The portal element is expected to always exist (-> PortalProvider).
          // eslint-disable-next-line @eslint-react/purity -- DOM query for createPortal target
          document.querySelector("#portal") as HTMLElement
        )}
    </StyledResizableContainer>
  )
}

const DataFrameWithFullscreen = withFullScreenWrapper(DataFrame)
export default memo(DataFrameWithFullscreen)
