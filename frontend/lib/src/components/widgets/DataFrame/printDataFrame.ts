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
  type GridCell,
  GridCellKind,
  type Item,
  type Rectangle,
} from "@glideapps/glide-data-grid"

import { PRINT_INACTIVE_ATTRIBUTE } from "~lib/components/shared/printPageBreak"
import {
  type BaseColumn,
  isErrorCell,
  isMissingValueCell,
  toSafeString,
} from "~lib/components/widgets/DataFrame/columns"
import { isNullOrUndefined } from "~lib/util/utils"

import { DATAFRAME_PRINT_TABLE_CLASS } from "./printClassNames"

/** Default text the grid draws for a missing value. */
const DEFAULT_MISSING_PLACEHOLDER = "None"

/** Column kinds that draw an empty missing cell instead of the placeholder. */
const SELF_DRAWN_MISSING_KINDS = new Set([
  "checkbox",
  "line_chart",
  "bar_chart",
  "progress",
])

/** Rows currently painted in the on-screen grid viewport. */
export interface DataFramePrintVisibleRows {
  /** First visible row index (inclusive). */
  startRow: number
  /** Number of visible rows. */
  rowCount: number
}

/** Optional settings for the printed table. */
export interface DataFramePrintOptions {
  /** Text drawn for a missing value. Defaults to `None`. */
  missingPlaceholder?: string
  /** Accessible name of the grid. A blank name leaves the table unnamed. */
  accessibleName?: string
}

/**
 * True when this element is mounted but not part of the printed page.
 *
 * Call this on the dataframe. The print slot is `display: none` on screen,
 * so checking the slot would hide every frame.
 */
export function isHiddenFromPrint(element: HTMLElement): boolean {
  if (element.closest(`[${PRINT_INACTIVE_ATTRIBUTE}], details:not([open])`)) {
    return true
  }
  if (typeof element.checkVisibility !== "function") {
    return false
  }
  return !element.checkVisibility({ visibilityProperty: true })
}

/**
 * Visible rows from a glide `onVisibleRegionChanged` rectangle.
 *
 * When the grid has not reported a region yet, every row is treated as
 * visible so a short frame still prints.
 */
export function visibleRowsFromRegion(
  region: Rectangle | null | undefined,
  numRows: number
): DataFramePrintVisibleRows {
  if (numRows <= 0) {
    return { startRow: 0, rowCount: 0 }
  }
  if (!region || region.height <= 0) {
    return { startRow: 0, rowCount: numRows }
  }
  const startRow = Math.max(0, Math.min(region.y, numRows - 1))
  const endRow = Math.min(numRows, region.y + region.height)
  return { startRow, rowCount: Math.max(0, endRow - startRow) }
}

/**
 * Build a print table of the rows currently painted in the grid viewport.
 *
 * The on-screen grid is a canvas of that viewport. A canvas cannot fragment
 * across pages, so printing it leaves a blank strip when the frame starts
 * mid-page. This HTML table can split, and it shows the same rows the user
 * sees on screen when they print.
 */
export function fillDataFramePrintSlot(
  slot: HTMLElement,
  columns: readonly BaseColumn[],
  getCellContent: (cell: Item) => GridCell,
  visibleRows: DataFramePrintVisibleRows,
  options: DataFramePrintOptions = {}
): void {
  clearDataFramePrintSlot(slot)

  const printable = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => !column.isHidden && column.kind !== "button")
  if (printable.length === 0 || visibleRows.rowCount <= 0) {
    return
  }

  const missingPlaceholder =
    options.missingPlaceholder ?? DEFAULT_MISSING_PLACEHOLDER
  const headers = printable.map(({ column }) => printColumnHeader(column))
  const rows: string[][] = []
  for (let offset = 0; offset < visibleRows.rowCount; offset++) {
    const row = visibleRows.startRow + offset
    rows.push(
      printable.map(({ column, index }) =>
        printCellText(getCellContent([index, row]), column, missingPlaceholder)
      )
    )
  }

  const table = renderPrintTable(headers, rows)
  const accessibleName = options.accessibleName?.trim()
  if (accessibleName !== undefined && accessibleName.length > 0) {
    table.setAttribute("aria-label", accessibleName)
  }
  slot.replaceChildren(table)
}

/** Drop the print table so the on-screen grid is unchanged after printing. */
export function clearDataFramePrintSlot(slot: HTMLElement): void {
  slot.replaceChildren()
}

/** Parent levels plus the leaf title, matching the grid's group row. */
function printColumnHeader(column: BaseColumn): string {
  const title = column.title || column.name || ""
  const group = column.group?.trim()
  if (group === undefined || group.length === 0) {
    return title
  }
  return title.length > 0 ? `${group} / ${title}` : group
}

/**
 * What the grid shows for this cell.
 *
 * Loading skeletons print as a blank. A missing value prints the placeholder
 * the grid draws over it. Formatted `displayData` is preferred so a
 * percentage prints as `42%` rather than the stored `0.42`.
 */
function printCellText(
  cell: GridCell,
  column: BaseColumn,
  missingPlaceholder: string
): string {
  if (cell.kind === GridCellKind.Loading) {
    return ""
  }

  if (
    !isErrorCell(cell) &&
    isMissingValueCell(cell) &&
    !SELF_DRAWN_MISSING_KINDS.has(column.kind)
  ) {
    return missingPlaceholder
  }

  if (cell.kind === GridCellKind.Boolean) {
    return cell.data === true ? "\u2713" : ""
  }

  if ("displayData" in cell) {
    const displayData = cell.displayData
    if (typeof displayData === "string") {
      return displayData
    }
    if (Array.isArray(displayData)) {
      return displayData.map(item => toSafeString(item)).join(", ")
    }
  }

  if (!("data" in cell) || isNullOrUndefined(cell.data)) {
    return ""
  }

  const data = cell.data
  if (
    typeof data === "string" ||
    typeof data === "number" ||
    typeof data === "boolean"
  ) {
    return String(data)
  }

  if (typeof data === "object") {
    return printRecordText(data as Record<string, unknown>)
  }

  return ""
}

function printRecordText(record: Record<string, unknown>): string {
  if (Array.isArray(record.displayValues)) {
    return record.displayValues.map(item => toSafeString(item)).join(", ")
  }
  if (typeof record.displayDate === "string") {
    return record.displayDate
  }
  if (typeof record.displayValue === "string") {
    return record.displayValue
  }
  if (typeof record.label === "string") {
    return record.label
  }
  if (Array.isArray(record.values)) {
    return record.values.map(item => toSafeString(item)).join(", ")
  }
  if (typeof record.value === "string" || typeof record.value === "number") {
    return String(record.value)
  }
  return ""
}

function renderPrintTable(
  headers: readonly string[],
  rows: readonly string[][]
): HTMLTableElement {
  const table = document.createElement("table")
  table.className = DATAFRAME_PRINT_TABLE_CLASS
  const head = document.createElement("tr")
  for (const header of headers) {
    const cell = document.createElement("th")
    cell.scope = "col"
    cell.textContent = header
    head.append(cell)
  }
  const thead = document.createElement("thead")
  thead.append(head)
  const body = document.createElement("tbody")
  for (const row of rows) {
    const line = document.createElement("tr")
    for (const text of row) {
      const cell = document.createElement("td")
      cell.textContent = text
      line.append(cell)
    }
    body.append(line)
  }
  table.append(thead, body)
  return table
}
