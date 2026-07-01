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

import { useMemo } from "react"

import { Dataframe as DataframeProto } from "@streamlit/protobuf"

/** Threshold for large tables that triggers performance optimizations. */
export const LARGE_TABLE_ROWS_THRESHOLD = 150000

/** Feature flags for the dataframe component. */
interface DataFrameCapabilities {
  /** Whether column sorting is enabled. */
  canSort: boolean
  /** Whether search functionality is enabled. */
  canSearch: boolean
  /** Whether CSV export is enabled. */
  canExportCsv: boolean
  /**
   * Whether the column statistics submenu can be shown. Only enabled for
   * read-only, non-empty, eagerly-loaded tables: statistics are derived from
   * the original data and would be stale for edited tables (e.g.
   * st.data_editor), meaningless for empty tables, and incomplete for lazy
   * dataframes (the bound Quiver only holds the loaded chunks, not all rows).
   */
  canShowColumnStatistics: boolean
  /** Whether cell editing is enabled. */
  canEdit: boolean
  /** Whether adding rows is enabled. */
  canAddRows: boolean
  /** Whether deleting rows is enabled. */
  canDeleteRows: boolean
  /** Whether the table is empty and should show empty state. */
  isEmptyTable: boolean
  /** Whether the table exceeds the large table threshold. */
  isLargeTable: boolean
  /** Whether the dataframe is rendered in lazy (chunk-loaded) mode. */
  isLazy: boolean
  /** Whether the device primarily uses touch input. */
  isTouchDevice: boolean
  /** Whether column resizing via drag is supported. Disabled on touch devices. */
  canResizeColumns: boolean
  /** Whether the fill handle for bulk editing is supported. Disabled on touch devices. */
  supportsFillHandle: boolean
  /** Whether rectangle (multi-cell) selection is supported. Touch devices use cell-only selection. */
  supportsRectangleSelection: boolean
}

interface UseDataFrameCapabilitiesParams {
  /** The editing mode from the proto element. */
  editingMode: DataframeProto.EditingMode
  /** Whether the widget is disabled. */
  disabled: boolean
  /** Number of data rows in the table. */
  numDataRows: number
  /** Number of data columns in the table. */
  numDataColumns: number
  /** Whether the dataframe is rendered in lazy (chunk-loaded) mode. */
  isLazy?: boolean
  /** Whether the lazy source supports server-side sorting. */
  lazySortable?: boolean
}

/**
 * Determines whether the table should show the empty state.
 * Empty tables are shown for zero rows, unless the editing mode allows adding
 * rows and there are data columns defined.
 */
function computeIsEmptyTable(
  numDataRows: number,
  numDataColumns: number,
  editingMode: DataframeProto.EditingMode
): boolean {
  const { DYNAMIC, ADD_ONLY } = DataframeProto.EditingMode
  if (numDataRows > 0) {
    return false
  }
  const canAddRowsInMode = editingMode === DYNAMIC || editingMode === ADD_ONLY
  return !(canAddRowsInMode && numDataColumns > 0)
}

/**
 * Custom hook that centralizes all capability/feature decisions for the
 * dataframe component.
 *
 * Rather than scattering conditional logic throughout the component, this hook
 * returns an explicit set of capability flags that can be used to enable or
 * disable features.
 */
function useDataFrameCapabilities({
  editingMode,
  disabled,
  numDataRows,
  numDataColumns,
  isLazy = false,
  lazySortable = false,
}: UseDataFrameCapabilitiesParams): DataFrameCapabilities {
  return useMemo(() => {
    const { READ_ONLY, DYNAMIC, ADD_ONLY, DELETE_ONLY } =
      DataframeProto.EditingMode

    const isTouchDevice =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)").matches ?? false)

    const isEmptyTable = computeIsEmptyTable(
      numDataRows,
      numDataColumns,
      editingMode
    )
    const isLargeTable = numDataRows > LARGE_TABLE_ROWS_THRESHOLD

    // In lazy mode, sorting is handled server-side and gated on the source's
    // `sortable` capability (not the large-table threshold). Search and CSV
    // export are disabled because they would only operate on loaded chunks.
    const canSort = isLazy
      ? lazySortable && !isEmptyTable
      : !isLargeTable &&
        !isEmptyTable &&
        editingMode !== DYNAMIC &&
        editingMode !== ADD_ONLY

    const canSearch = !isLazy && !isEmptyTable

    const canExportCsv = !isLazy && !isLargeTable && !isEmptyTable

    // Statistics are computed over the locally-available Quiver, so they are
    // only meaningful for read-only, non-empty, eagerly-loaded dataframes.
    // Editable tables would show stale (pre-edit) stats, and lazy dataframes
    // only hold the loaded chunks rather than all rows.
    const canShowColumnStatistics =
      !isLazy && !isEmptyTable && editingMode === READ_ONLY

    const canEdit =
      !isLazy && !isEmptyTable && editingMode !== READ_ONLY && !disabled

    const canAddRows =
      !isEmptyTable &&
      (editingMode === DYNAMIC || editingMode === ADD_ONLY) &&
      !disabled

    const canDeleteRows =
      !isEmptyTable &&
      (editingMode === DYNAMIC || editingMode === DELETE_ONLY) &&
      !disabled

    const canResizeColumns = !isTouchDevice

    const supportsFillHandle = canEdit && !isTouchDevice

    const supportsRectangleSelection = !isTouchDevice

    return {
      canSort,
      canSearch,
      canExportCsv,
      canShowColumnStatistics,
      canEdit,
      canAddRows,
      canDeleteRows,
      isEmptyTable,
      isLargeTable,
      isLazy,
      isTouchDevice,
      canResizeColumns,
      supportsFillHandle,
      supportsRectangleSelection,
    }
  }, [
    editingMode,
    disabled,
    numDataRows,
    numDataColumns,
    isLazy,
    lazySortable,
  ])
}

export default useDataFrameCapabilities
