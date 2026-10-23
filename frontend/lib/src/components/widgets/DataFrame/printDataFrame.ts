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
} from "@glideapps/glide-data-grid"

import {
  type BaseColumn,
  toSafeString,
} from "~lib/components/widgets/DataFrame/columns"
import { isNullOrUndefined } from "~lib/util/utils"

/** Class of the HTML table that replaces the canvas grid when printing. */
export const DATAFRAME_PRINT_TABLE_CLASS = "stDataFramePrintTable"

/** Shown instead of that table when the frame cannot be expanded. */
export const DATAFRAME_PRINT_NOTE_CLASS = "stDataFramePrintNote"

/**
 * Natural width of the print table, in px. Print CSS divides the column width
 * by this length. The division uses `tan(atan2(...))` so the scale is a
 * number in browsers that cannot divide two lengths inside `calc()`.
 */
export const DATAFRAME_PRINT_WIDTH_VAR = "--st-df-print-width"

/**
 * Font and spacing the print table renders with. Width is measured from a
 * copy laid out with these, because `beforeprint` still uses screen media
 * and the print rules are not active yet.
 */
export interface DataFramePrintMeasure {
  /** App body font, such as `"Source Sans", sans-serif`. */
  fontFamily: string
  /** Body font size, such as `1rem`. */
  fontSize: string
  /** Horizontal and vertical padding, such as `0.125rem 0.5rem`. */
  padding: string
  cellWeight: number
  headerWeight: number
  /** Fixed box for an image cell, so a data URL is not measured as text. */
  imageWidth: string
  imageHeight: string
}

/** Theme fields that decide the print table's font and column spacing. */
interface DataFramePrintMeasureTheme {
  fontSizes: { md: string }
  fontWeights: { normal: number; semiBold: number }
  genericFonts: { bodyFont: string }
  spacing: { threeXS: string; sm: string; threeXL: string; fourXL: string }
}

/**
 * Largest frame that is expanded into a table during `beforeprint`.
 *
 * The handler runs on the main thread before the print preview. Past this
 * many cells the table's DOM and the browser's print layout stall the tab,
 * so the on-screen canvas is left in place.
 */
export const DATAFRAME_PRINT_CELL_LIMIT = 50_000

/**
 * Font and spacing of the printed table for the active theme.
 *
 * The table uses the app body font at `md`, semi-bold headers, and padding of
 * `threeXS` and `sm`. The off-screen measurement uses these same values.
 * Cell borders are omitted because `zoom` does not scale their layout width.
 */
export function buildDataFramePrintMeasure(
  theme: DataFramePrintMeasureTheme
): DataFramePrintMeasure {
  return {
    fontFamily: theme.genericFonts.bodyFont,
    fontSize: theme.fontSizes.md,
    padding: `${theme.spacing.threeXS} ${theme.spacing.sm}`,
    cellWeight: theme.fontWeights.normal,
    headerWeight: theme.fontWeights.semiBold,
    imageWidth: theme.spacing.fourXL,
    imageHeight: theme.spacing.threeXL,
  }
}

/**
 * True when this element is mounted but not part of the printed page.
 *
 * A closed tab and a collapsed expander stay in the DOM. A print table
 * there would still match `:has(.stDataFramePrintTable)` and let the
 * surrounding card split. The slot itself is `display: none` on screen,
 * so this is called on the dataframe, not the slot.
 */
export function isHiddenFromPrint(element: HTMLElement): boolean {
  if (element.closest("[data-st-inactive], details:not([open])")) {
    return true
  }
  // Other unprinted subtrees (for example a display:none ancestor) are
  // not named above. Off-screen content still counts as visible.
  if (typeof element.checkVisibility !== "function") {
    return false
  }
  return !element.checkVisibility({
    checkOpacity: false,
    checkVisibilityCSS: true,
  })
}

/**
 * Build a table of every visible cell and remember how wide it is.
 *
 * The on-screen grid is a canvas of the viewport, so columns that sit past
 * the scroll edge are never painted. Printing that canvas cuts them off.
 * This table is the whole frame when every row is already loaded and the
 * frame is small enough to lay out during `beforeprint`. Print CSS scales it
 * down to the page, and a PDF viewer can zoom back in.
 *
 * The width comes from an off-screen copy of the table. `beforeprint` still
 * uses screen media, so the print font and padding are not applied to the
 * slot, and canvas text metrics are narrower than the laid-out cells.
 */
export function fillDataFramePrintSlot(
  slot: HTMLElement,
  columns: readonly BaseColumn[],
  numRows: number,
  getCellContent: (cell: Item) => GridCell,
  measure: DataFramePrintMeasure
): void {
  clearDataFramePrintSlot(slot)

  const printable = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => !column.isHidden && column.kind !== "button")
  if (printable.length === 0 || numRows <= 0) {
    return
  }

  if (numRows * printable.length > DATAFRAME_PRINT_CELL_LIMIT) {
    setPrintNote(
      slot,
      "Only the visible part of this table is printed because it is too large to expand."
    )
    return
  }

  const headers = printable.map(
    ({ column }) => column.title || column.name || ""
  )
  const rows: PrintCellContent[][] = []
  for (let row = 0; row < numRows; row++) {
    const cells: PrintCellContent[] = []
    for (const { index } of printable) {
      const content = printCellContent(getCellContent([index, row]))
      // An unloaded lazy row cannot be fetched before the browser snapshots
      // the page. A partial table would show blanks, so keep the canvas.
      if (content === null) {
        setPrintNote(
          slot,
          "Only the visible part of this table is printed because some rows are still loading."
        )
        return
      }
      cells.push(content)
    }
    rows.push(cells)
  }

  const table = renderPrintTable(headers, rows)
  const width = measurePrintWidth(table, measure)
  if (width > 0) {
    slot.style.setProperty(DATAFRAME_PRINT_WIDTH_VAR, `${width}px`)
  }
  slot.replaceChildren(table)
}

/** Drop the print table so the on-screen grid is unchanged after printing. */
export function clearDataFramePrintSlot(slot: HTMLElement): void {
  slot.replaceChildren()
  slot.style.removeProperty(DATAFRAME_PRINT_WIDTH_VAR)
}

/** What one printed cell shows. `null` means the row is still being fetched. */
type PrintCellContent =
  | { kind: "text"; text: string }
  | { kind: "images"; urls: string[] }

/**
 * What the grid shows for this cell.
 *
 * `null` means the row is still being fetched. Empty progress and chart cells
 * use the same loading kind, without a skeleton, and print as a blank. The
 * formatted display is used when the column has one, so a percentage prints
 * as `42%` rather than the stored `0.42`. An image prints as an image, not
 * as its URL, so a data URL cannot shrink the other columns.
 */
function printCellContent(cell: GridCell): PrintCellContent | null {
  if (cell.kind === GridCellKind.Loading) {
    // Unloaded lazy rows draw a skeleton. An empty cell has none.
    return cell.skeletonWidth === undefined ? { kind: "text", text: "" } : null
  }

  if (cell.kind === GridCellKind.Image && "displayData" in cell) {
    const urls = Array.isArray(cell.displayData)
      ? cell.displayData.filter(
          (item): item is string => typeof item === "string" && item !== ""
        )
      : []
    return urls.length > 0
      ? { kind: "images", urls }
      : { kind: "text", text: "" }
  }

  if ("displayData" in cell) {
    const displayData = cell.displayData
    if (typeof displayData === "string") {
      return { kind: "text", text: displayData }
    }
    if (Array.isArray(displayData)) {
      return {
        kind: "text",
        text: displayData.map(item => toSafeString(item)).join(", "),
      }
    }
  }

  if (!("data" in cell) || isNullOrUndefined(cell.data)) {
    return { kind: "text", text: "" }
  }

  const data = cell.data
  if (
    typeof data === "string" ||
    typeof data === "number" ||
    typeof data === "boolean"
  ) {
    return { kind: "text", text: String(data) }
  }

  if (typeof data === "object") {
    return {
      kind: "text",
      text: printRecordText(data as Record<string, unknown>),
    }
  }

  return { kind: "text", text: "" }
}

function printRecordText(record: Record<string, unknown>): string {
  if (record.kind === "dropdown-cell") {
    return printDropdownText(record)
  }
  if (record.kind === "media-cell") {
    return typeof record.src === "string" ? record.src : ""
  }
  // A sparkline stores the normalized series on `values` and the formatted
  // numbers on `displayValues`. List and multiselect cells only have `values`,
  // so the formatted series has to win when both exist.
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
  return ""
}

function isLabeledOption(
  option: unknown
): option is { value: unknown; label: string } {
  return (
    option !== null &&
    typeof option === "object" &&
    "value" in option &&
    "label" in option &&
    typeof option.label === "string"
  )
}

function printDropdownText(record: Record<string, unknown>): string {
  const value = record.value
  if (isNullOrUndefined(value) || value === "") {
    return ""
  }
  if (Array.isArray(record.allowedValues)) {
    for (const option of record.allowedValues) {
      if (isLabeledOption(option) && option.value === value) {
        return option.label
      }
    }
  }
  return toSafeString(value)
}

function measurePrintWidth(
  table: HTMLTableElement,
  measure: DataFramePrintMeasure
): number {
  const probe = document.createElement("div")
  // An absolute box with width:auto is shrink-to-fit and Chromium clamps
  // that to the viewport, so a wider table was measured too narrow and the
  // print zoom stayed near 1. max-content is the table's own width.
  probe.style.position = "absolute"
  probe.style.visibility = "hidden"
  probe.style.left = "0"
  probe.style.top = "0"
  probe.style.width = "max-content"
  probe.style.maxWidth = "none"
  const style = document.createElement("style")
  style.textContent = printMeasureCss(measure)
  probe.append(style, table.cloneNode(true))
  document.body.append(probe)
  const laidOut = probe.querySelector("table")
  // beforeprint still uses screen media, so this copy is the only laid-out
  // table. The print slot itself is display:none and has no width.
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- The print snapshot cannot wait for a resize observer
  const width = laidOut instanceof HTMLElement ? laidOut.scrollWidth : 0
  probe.remove()
  return width
}

function printMeasureCss(measure: DataFramePrintMeasure): string {
  const table = `.${DATAFRAME_PRINT_TABLE_CLASS}`
  return `
    ${table} {
      border-collapse: collapse;
      width: max-content;
      font-family: ${measure.fontFamily};
      font-size: ${measure.fontSize};
    }
    ${table} th, ${table} td {
      white-space: nowrap;
      padding: ${measure.padding};
      border: 0;
      font-weight: ${measure.cellWeight};
      text-align: left;
    }
    ${table} th { font-weight: ${measure.headerWeight}; }
    ${table} img {
      width: ${measure.imageWidth};
      height: ${measure.imageHeight};
      object-fit: contain;
    }
  `
}

function renderPrintTable(
  headers: readonly string[],
  rows: readonly PrintCellContent[][]
): HTMLTableElement {
  const table = document.createElement("table")
  table.className = DATAFRAME_PRINT_TABLE_CLASS
  const head = document.createElement("tr")
  for (const header of headers) {
    const cell = document.createElement("th")
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
      if (content.kind === "images") {
        for (const url of content.urls) {
          const image = document.createElement("img")
          image.alt = ""
          image.src = url
          cell.append(image)
        }
      } else {
        cell.textContent = content.text
      }
      line.append(cell)
    }
    body.append(line)
  }
  table.append(thead, body)
  return table
}

function setPrintNote(slot: HTMLElement, message: string): void {
  const note = document.createElement("p")
  note.className = DATAFRAME_PRINT_NOTE_CLASS
  note.textContent = message
  slot.replaceChildren(note)
}
