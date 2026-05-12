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

    const canSort =
      !isLargeTable &&
      !isEmptyTable &&
      editingMode !== DYNAMIC &&
      editingMode !== ADD_ONLY

    const canSearch = !isEmptyTable

    const canExportCsv = !isLargeTable && !isEmptyTable

    const canEdit = !isEmptyTable && editingMode !== READ_ONLY && !disabled

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
      canEdit,
      canAddRows,
      canDeleteRows,
      isEmptyTable,
      isLargeTable,
      isTouchDevice,
      canResizeColumns,
      supportsFillHandle,
      supportsRectangleSelection,
    }
  }, [editingMode, disabled, numDataRows, numDataColumns])
}

export default useDataFrameCapabilities
