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
import { convertRemToPx } from "~lib/theme/utils"
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
 * Font and spacing the print table renders with. Width is measured from
 * these, because `beforeprint` still uses screen media and the slot has no
 * layout to read.
 */
export interface DataFramePrintMeasure {
  /** Canvas font for body cells, such as `400 16px "Source Sans", sans-serif`. */
  cellFont: string
  /** Canvas font for headers. Headers are heavier than body cells. */
  headerFont: string
  /** Horizontal padding and the shared border of one column, in px. */
  columnChromePx: number
  /** The table's outer border, which collapsed borders do not share. */
  trailingBorderPx: number
}

/** Theme fields that decide the print table's font and column spacing. */
interface DataFramePrintMeasureTheme {
  fontSizes: { md: string; baseFontSize: number }
  fontWeights: { normal: number; semiBold: number }
  genericFonts: { bodyFont: string }
  spacing: { sm: string }
  sizes: { borderWidth: string }
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
 * The table uses the app body font at `md`, semi-bold headers, horizontal
 * padding of `spacing.sm`, and a `borderWidth` border. A larger base font
 * size or a custom family changes those lengths, so the measurement uses the
 * same values the stylesheet applies.
 */
export function buildDataFramePrintMeasure(
  theme: DataFramePrintMeasureTheme
): DataFramePrintMeasure {
  const rootPx = theme.fontSizes.baseFontSize
  const fontSizePx = convertRemToPx(theme.fontSizes.md, rootPx)
  const paddingPx = convertRemToPx(theme.spacing.sm, rootPx)
  const borderPx = Number.parseFloat(theme.sizes.borderWidth)
  const border = Number.isFinite(borderPx) ? borderPx : 0

  return {
    cellFont: `${theme.fontWeights.normal} ${fontSizePx}px ${theme.genericFonts.bodyFont}`,
    headerFont: `${theme.fontWeights.semiBold} ${fontSizePx}px ${theme.genericFonts.bodyFont}`,
    columnChromePx: paddingPx * 2 + border,
    trailingBorderPx: border,
  }
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
 * The width comes from the cell text measured in the table's font. `beforeprint`
 * still uses screen media, where this slot is `display: none` and has no
 * layout, and the printed column is a different width from the screen, so
 * reading `offsetWidth` cannot size it.
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
      "This table is too large to expand for print, so the on-screen grid is shown."
    )
    return
  }

  const headers = printable.map(
    ({ column }) => column.title || column.name || ""
  )
  const rows: string[][] = []
  for (let row = 0; row < numRows; row++) {
    const texts: string[] = []
    for (const { index } of printable) {
      const text = printCellText(getCellContent([index, row]))
      // An unloaded lazy row cannot be fetched before the browser snapshots
      // the page. A partial table would show blanks, so keep the canvas.
      if (text === null) {
        setPrintNote(
          slot,
          "Some rows are still loading, so the on-screen grid is shown."
        )
        return
      }
      texts.push(text)
    }
    rows.push(texts)
  }

  const width = measurePrintWidth(headers, rows, measure)
  if (width > 0) {
    slot.style.setProperty(DATAFRAME_PRINT_WIDTH_VAR, `${width}px`)
  }
  slot.innerHTML = renderPrintTable(headers, rows)
}

/** Drop the print table so the on-screen grid is unchanged after printing. */
export function clearDataFramePrintSlot(slot: HTMLElement): void {
  slot.replaceChildren()
  slot.style.removeProperty(DATAFRAME_PRINT_WIDTH_VAR)
}

/**
 * Text the grid shows for this cell.
 *
 * `null` means the row is still being fetched. Empty progress and chart cells
 * use the same loading kind, without a skeleton, and print as a blank. The
 * formatted display is used when the column has one, so a percentage prints
 * as `42%` rather than the stored `0.42`.
 */
function printCellText(cell: GridCell): string | null {
  if (cell.kind === GridCellKind.Loading) {
    // Unloaded lazy rows draw a skeleton. An empty cell has none.
    return cell.skeletonWidth === undefined ? "" : null
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
    const record = data as Record<string, unknown>
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
  }

  return ""
}

function measurePrintWidth(
  headers: readonly string[],
  rows: readonly string[][],
  measure: DataFramePrintMeasure
): number {
  const context = document.createElement("canvas").getContext("2d")
  if (!context) {
    return 0
  }

  let total = measure.trailingBorderPx
  headers.forEach((header, column) => {
    context.font = measure.headerFont
    let widest = textWidth(context, header)
    context.font = measure.cellFont
    for (const row of rows) {
      widest = Math.max(widest, textWidth(context, row[column] ?? ""))
    }
    total += widest + measure.columnChromePx
  })
  return Math.ceil(total)
}

function textWidth(context: CanvasRenderingContext2D, text: string): number {
  return Math.ceil(context.measureText(text).width)
}

function renderPrintTable(
  headers: readonly string[],
  rows: readonly string[][]
): string {
  const head = headers.map(text => `<th>${escapeHtml(text)}</th>`).join("")
  const body = rows
    .map(
      row =>
        `<tr>${row.map(text => `<td>${escapeHtml(text)}</td>`).join("")}</tr>`
    )
    .join("")
  return `<table class="${DATAFRAME_PRINT_TABLE_CLASS}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function setPrintNote(slot: HTMLElement, message: string): void {
  const note = document.createElement("p")
  note.className = DATAFRAME_PRINT_NOTE_CLASS
  note.textContent = message
  slot.replaceChildren(note)
}
