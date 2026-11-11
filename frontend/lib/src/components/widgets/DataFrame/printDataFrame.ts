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
  DEFAULT_MISSING_PLACEHOLDER,
  isErrorCell,
  isMissingValueCell,
  SELF_DRAWN_MISSING_KINDS,
  toSafeString,
} from "~lib/components/widgets/DataFrame/columns"
import { genericFonts } from "~lib/theme/primitives/typography"
import { isNullOrUndefined } from "~lib/util/utils"

import { DATAFRAME_PRINT_TABLE_CLASS } from "./printClassNames"

/**
 * Rows printed when the grid has not reported a region yet. Bounds the DOM
 * built synchronously in `beforeprint` for a large frame.
 */
const MAX_FALLBACK_PRINT_ROWS = 100

/** Printed content of one cell: text, or the image URLs of an image cell. */
type PrintCell = string | { imageUrls: readonly string[] }

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
 * Falls back to the first rows (up to `MAX_FALLBACK_PRINT_ROWS`) when the
 * grid has not reported a region yet, so a short dataframe still prints in
 * full.
 */
export function visibleRowsFromRegion(
  region: Rectangle | null | undefined,
  numRows: number
): DataFramePrintVisibleRows {
  if (numRows <= 0) {
    return { startRow: 0, rowCount: 0 }
  }
  if (!region || region.height <= 0) {
    return {
      startRow: 0,
      rowCount: Math.min(numRows, MAX_FALLBACK_PRINT_ROWS),
    }
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
  const rows: PrintCell[][] = []
  for (let offset = 0; offset < visibleRows.rowCount; offset++) {
    const row = visibleRows.startRow + offset
    rows.push(
      printable.map(({ column, index }) =>
        printCellContent(
          getCellContent([index, row]),
          column,
          missingPlaceholder
        )
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
  const title = column.title
  const group = column.group?.trim()
  if (group === undefined || group.length === 0) {
    return title
  }
  return title.length > 0 ? `${group} / ${title}` : group
}

/**
 * What the grid shows for this cell.
 *
 * Loading skeletons, such as rows of a lazy dataframe whose chunk is still
 * in flight, print as a blank. A missing value prints the placeholder the
 * grid draws over it. Image cells print their images. Formatted
 * `displayData` is preferred so a percentage prints as `42%` rather than the
 * stored `0.42`. Custom cells without a known display field fall back to
 * their `copyData` text.
 */
function printCellContent(
  cell: GridCell,
  column: BaseColumn,
  missingPlaceholder: string
): PrintCell {
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
    // A missing checkbox is a self-drawn empty cell and stays blank. Print
    // an empty box for `false` so it is not the same as a missing value.
    if (cell.data === true) {
      return "\u2713"
    }
    if (cell.data === false) {
      return "\u2610"
    }
    return ""
  }

  if (cell.kind === GridCellKind.Image) {
    return { imageUrls: cell.data }
  }

  // LinkColumn icon cells store a Material ligature or codepoint in
  // displayData. That glyph needs the icon font, which print does not
  // apply, so use the URL instead.
  if (
    cell.kind === GridCellKind.Uri &&
    cell.themeOverride?.fontFamily === genericFonts.iconFont &&
    typeof cell.data === "string"
  ) {
    return cell.data
  }

  if ("displayData" in cell) {
    const displayData: unknown = cell.displayData
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
    const text = printRecordText(data as Record<string, unknown>)
    if (text.length > 0) {
      return text
    }
  }

  return "copyData" in cell && typeof cell.copyData === "string"
    ? cell.copyData
    : ""
}

/** Label of the option with this value, so `format_func` labels print. */
function optionLabel(options: unknown, value: unknown): string {
  const text = toSafeString(value)
  if (!Array.isArray(options)) {
    return text
  }
  for (const option of options as unknown[]) {
    if (
      typeof option === "object" &&
      option !== null &&
      "value" in option &&
      option.value === text &&
      "label" in option &&
      typeof option.label === "string"
    ) {
      return option.label
    }
  }
  return text
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
    return record.values
      .map(item => optionLabel(record.options, item))
      .join(", ")
  }
  if (typeof record.value === "string" || typeof record.value === "number") {
    return optionLabel(record.allowedValues, record.value)
  }
  return ""
}

function renderPrintTable(
  headers: readonly string[],
  rows: readonly PrintCell[][]
): HTMLTableElement {
  const table = document.createElement("table")
  table.className = DATAFRAME_PRINT_TABLE_CLASS
  table.dataset.testid = DATAFRAME_PRINT_TABLE_CLASS
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
    for (const content of row) {
      const cell = document.createElement("td")
      if (typeof content === "string") {
        cell.textContent = content
      } else {
        for (const url of content.imageUrls) {
          const image = document.createElement("img")
          image.src = url
          image.alt = ""
          cell.append(image)
        }
      }
      line.append(cell)
    }
    body.append(line)
  }
  table.append(thead, body)
  return table
}
