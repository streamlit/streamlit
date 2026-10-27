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
import { genericFonts } from "~lib/theme/primitives/typography"
import { isNullOrUndefined } from "~lib/util/utils"

import {
  DATAFRAME_PRINT_NOTE_CLASS,
  DATAFRAME_PRINT_SCALE_CLASS,
  DATAFRAME_PRINT_SCALE_VAR,
  DATAFRAME_PRINT_TABLE_CLASS,
  DATAFRAME_PRINT_WIDTH_VAR,
} from "./printClassNames"

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
 * Most cells one print expands into tables.
 *
 * The handler runs on the main thread before the print preview. Past this
 * many cells the table's DOM and the browser's print layout stall the tab.
 * Every dataframe on the page shares the budget. A frame that cannot fit one
 * more row keeps the on-screen canvas. A wide frame that can fit a shorter
 * prefix prints that prefix instead.
 */
export const DATAFRAME_PRINT_CELL_LIMIT = 50_000

/**
 * Most rows one dataframe expands into a print table.
 *
 * A longer frame prints this prefix and a note that further rows were left
 * out. The cell budget can stop the prefix sooner.
 */
export const DATAFRAME_PRINT_ROW_LIMIT = 1_000

/**
 * Most images one print table will request.
 *
 * The on-screen grid only fetches images in visible rows. Expanding every
 * loaded image cell starts a request per URL, and most of them are still
 * loading when the browser snapshots the page. Past this many images the
 * canvas stays in place.
 */
export const DATAFRAME_PRINT_IMAGE_LIMIT = 32

/** Definite probe width so Chromium does not clamp a wide table to the viewport while measuring. */
const PRINT_MEASURE_WIDTH = "100000px"

/**
 * Cells still available for this print.
 *
 * Each dataframe has its own `beforeprint` listener. They share one budget
 * so several medium frames cannot all expand in the same pass.
 */
export interface DataFramePrintBudget {
  remaining: number
}

const printBudgets = new WeakMap<Event, DataFramePrintBudget>()

/** Budget for every dataframe that handles this same `beforeprint` event. */
export function dataFramePrintBudget(event: Event): DataFramePrintBudget {
  const existing = printBudgets.get(event)
  if (existing) {
    return existing
  }
  const created = { remaining: DATAFRAME_PRINT_CELL_LIMIT }
  printBudgets.set(event, created)
  return created
}

/**
 * Font and spacing of the printed table for the active theme.
 *
 * The table uses the app body font at `md`, semi-bold headers, and padding of
 * `threeXS` and `sm`. The off-screen measurement uses these same values.
 * Cell borders are omitted. An outline draws the grid, and the probe uses
 * the same box so the measured width matches the printed cells.
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
 * Call this on the dataframe. The print slot is `display: none` on screen,
 * so checking the slot would hide every frame. A print table in an
 * unprinted frame would still match `:has(.stDataFramePrintTable)` and
 * spend the shared cell budget.
 *
 * Unprinted when any of these match:
 * - a closed tab (`[data-st-inactive]`)
 * - a collapsed expander (`details:not([open])`)
 * - a collapsed sidebar (`[data-collapsed='true']`). `translateX` still
 *   counts as visible to `checkVisibility`, and `beforeprint` uses screen
 *   media, so the sidebar's print `display: none` is not active yet
 * - any other `display: none` ancestor
 */
export function isHiddenFromPrint(element: HTMLElement): boolean {
  if (
    element.closest(
      "[data-st-inactive], details:not([open]), [data-collapsed='true']"
    )
  ) {
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
 * frame fits the row cap and the page's cell budget. A longer frame prints
 * the first rows that fit, then a note. Print CSS scales the type down to
 * the page, and a PDF viewer can zoom back in.
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
  measure: DataFramePrintMeasure,
  budget?: DataFramePrintBudget
): void {
  clearDataFramePrintSlot(slot)

  const printable = columns
    .map((column, index) => ({ column, index }))
    // Button labels are interactive controls, not dataframe values. Match
    // the CSV export and leave them out of the static print table.
    .filter(({ column }) => !column.isHidden && column.kind !== "button")
  if (printable.length === 0 || numRows <= 0) {
    return
  }

  const columnCount = printable.length
  const cellLimit = budget?.remaining ?? DATAFRAME_PRINT_CELL_LIMIT
  // The row cap is the product limit. The cell budget can stop earlier when
  // the table is wide or earlier frames have already spent the page.
  const rowsToPrint = Math.min(
    numRows,
    DATAFRAME_PRINT_ROW_LIMIT,
    Math.floor(cellLimit / columnCount)
  )
  if (rowsToPrint <= 0) {
    // Not one row fits. Keep the canvas. A full page budget means this
    // frame is too large on its own. A smaller budget means earlier tables
    // already spent it.
    setPrintNote(slot, visiblePartNote(cellLimit))
    return
  }
  const cellCount = rowsToPrint * columnCount
  if (budget) {
    budget.remaining -= cellCount
  }

  const headers = printable.map(({ column }) => printColumnHeader(column))
  const rows: PrintCellContent[][] = []
  let imageCount = 0
  for (let row = 0; row < rowsToPrint; row++) {
    const cells: PrintCellContent[] = []
    for (const { index } of printable) {
      const content = printCellContent(getCellContent([index, row]))
      // An unloaded lazy row cannot be fetched before the browser snapshots
      // the page. A partial table would show blanks, so keep the canvas.
      if (content === null) {
        if (budget) {
          budget.remaining += cellCount
        }
        setPrintNote(
          slot,
          "Only the visible part of this table is printed because some rows are still loading."
        )
        return
      }
      if (content.kind === "images") {
        imageCount += content.urls.length
        if (imageCount > DATAFRAME_PRINT_IMAGE_LIMIT) {
          if (budget) {
            budget.remaining += cellCount
          }
          setPrintNote(
            slot,
            "Only the visible part of this table is printed because it has too many images."
          )
          return
        }
      }
      cells.push(content)
    }
    rows.push(cells)
  }

  const table = renderPrintTable(headers, rows)
  // The slot is display:none until print media, so its width is 0 while
  // beforeprint still uses screen media. The dataframe itself is on screen.
  // Read it before the table is inserted: a wide table can stretch the frame
  // and the scale would then stay at 1.
  const available = availablePrintWidth(slot)
  const measured = measurePrintTable(table, measure)
  if (measured.width > 0) {
    slot.style.setProperty(DATAFRAME_PRINT_WIDTH_VAR, `${measured.width}px`)
  }
  // Percentage columns plus a fixed layout let the print rule cap the
  // table at the column. A px width would stay at the natural size and
  // paint past the column once the type shrinks.
  applyPrintColumnWidths(table, measured.columns)
  const scale = document.createElement("div")
  scale.className = DATAFRAME_PRINT_SCALE_CLASS
  scale.append(table)
  slot.replaceChildren(scale)
  // The note stays outside the scaled table so it prints at the body size.
  if (numRows > rowsToPrint) {
    slot.append(printNote(rowCapNote(rowsToPrint, cellLimit)))
  }
  applyPrintScale(slot, available, measured.width)
}

/** Parent levels plus the leaf title, matching the grid's group row. */
function printColumnHeader(column: BaseColumn): string {
  const title = column.title || column.name || ""
  const group = column.group?.trim()
  if (!group) {
    return title
  }
  return title ? `${group} / ${title}` : group
}

/**
 * Give each column its share of the table.
 *
 * The print rule sets the table width to the column when the natural width
 * is wider. Fixed percentages keep that shrink proportional. A px width
 * would not shrink with the column.
 */
function applyPrintColumnWidths(
  table: HTMLTableElement,
  columns: readonly number[]
): void {
  const sum = columns.reduce((total, cellWidth) => total + cellWidth, 0)
  if (sum <= 0) {
    return
  }
  table.querySelector("colgroup")?.remove()
  const group = document.createElement("colgroup")
  for (const cellWidth of columns) {
    const col = document.createElement("col")
    col.style.width = `${(cellWidth / sum) * 100}%`
    group.append(col)
  }
  table.prepend(group)
  table.style.tableLayout = "fixed"
}

/**
 * Measure the print table at its full font size and record any wider columns.
 *
 * `beforeprint` often still uses screen media, so the first ratio is the
 * on-screen column. When print media starts, the column is the page width
 * and this runs again. The font ratio is already applied by then, so this
 * forces a scale of 1 for the read. Measuring the fitted type would store a
 * width that the stylesheet scales a second time.
 */
export function fitDataFramePrintTable(slot: HTMLElement): void {
  const scale = slot.querySelector(`.${DATAFRAME_PRINT_SCALE_CLASS}`)
  if (!(scale instanceof HTMLElement)) {
    return
  }
  const table = scale.querySelector("table")
  if (!(table instanceof HTMLTableElement)) {
    return
  }
  const recorded = Number.parseFloat(
    slot.style.getPropertyValue(DATAFRAME_PRINT_WIDTH_VAR)
  )
  // Read the column before the unscaled table can stretch the dataframe.
  const available = availablePrintWidth(slot)
  slot.style.setProperty(DATAFRAME_PRINT_SCALE_VAR, "1")
  table.querySelector("colgroup")?.remove()
  table.style.width =
    Number.isFinite(recorded) && recorded > 0 ? `${recorded}px` : "max-content"
  table.style.tableLayout = "auto"
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- The print snapshot cannot wait for a resize observer
  const laidOut = table.offsetWidth
  const row = table.rows[0]
  const columns =
    row instanceof HTMLTableRowElement
      ? [...row.cells].map(
          // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- The print snapshot cannot wait for a resize observer
          cell => cell.offsetWidth
        )
      : []
  const sum = columns.reduce((total, cellWidth) => total + cellWidth, 0)
  const width = Math.max(
    laidOut,
    Number.isFinite(recorded) ? recorded : 0,
    sum
  )

  // Drop the measurement overrides. The print rule caps the table width,
  // and percentage columns are applied below when the read succeeded.
  table.style.width = ""
  table.style.tableLayout = ""
  slot.style.removeProperty(DATAFRAME_PRINT_SCALE_VAR)
  if (width > 0 && (!Number.isFinite(recorded) || width > recorded)) {
    slot.style.setProperty(DATAFRAME_PRINT_WIDTH_VAR, `${width}px`)
  }
  applyPrintColumnWidths(table, columns)
  if (width <= 0) {
    return
  }
  applyPrintScale(slot, available, width)
}

/** Width of the visible dataframe, or the slot when it is measured alone. */
function availablePrintWidth(slot: HTMLElement): number {
  const frame = slot.closest(".stDataFrame")
  const box = frame instanceof HTMLElement ? frame : slot
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- The print snapshot cannot wait for a resize observer
  return box.clientWidth
}

/** Drop the print table so the on-screen grid is unchanged after printing. */
export function clearDataFramePrintSlot(slot: HTMLElement): void {
  slot.replaceChildren()
  slot.style.removeProperty(DATAFRAME_PRINT_WIDTH_VAR)
  slot.style.removeProperty(DATAFRAME_PRINT_SCALE_VAR)
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

  if (cell.kind === GridCellKind.Boolean) {
    // A checkbox has no display text. Print the mark the grid draws, and a
    // blank for an unchecked or empty cell, instead of `true` / `false`.
    return { kind: "text", text: cell.data === true ? "\u2713" : "" }
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

  if (
    cell.kind === GridCellKind.Uri &&
    cell.themeOverride?.fontFamily === genericFonts.iconFont
  ) {
    // Icon-only links store the glyph in displayData and the URL in data.
    // The print table uses the body font, so print the URL instead.
    return {
      kind: "text",
      text: typeof cell.data === "string" ? cell.data : "",
    }
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

function printMediaText(record: Record<string, unknown>): string {
  const src = typeof record.src === "string" ? record.src : ""
  // An https URL is the cell value, and a PDF can keep that link. A data
  // URL is a base64 payload. Print cells do not wrap, so that string would
  // set the table width and shrink the other columns.
  if (!src.startsWith("data:")) {
    return src
  }
  if (record.mediaType === "audio") {
    return "Audio"
  }
  if (record.mediaType === "video") {
    return "Video"
  }
  return "Media"
}

function printRecordText(record: Record<string, unknown>): string {
  if (record.kind === "dropdown-cell") {
    return printDropdownText(record)
  }
  if (record.kind === "multi-select-cell") {
    return printMultiSelectText(record)
  }
  if (record.kind === "media-cell") {
    return printMediaText(record)
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

function printMultiSelectText(record: Record<string, unknown>): string {
  if (!Array.isArray(record.values)) {
    return ""
  }
  return record.values
    .map(value => printOptionLabel(value, record.options))
    .join(", ")
}

function printOptionLabel(value: unknown, options: unknown): string {
  if (Array.isArray(options)) {
    const option = options.find(
      candidate => isLabeledOption(candidate) && candidate.value === value
    )
    if (isLabeledOption(option)) {
      return option.label
    }
  }
  return toSafeString(value)
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
    return printOptionLabel(value, record.allowedValues)
  }
  return toSafeString(value)
}

interface PrintTableMeasurement {
  width: number
  columns: number[]
}

function measurePrintTable(
  table: HTMLTableElement,
  measure: DataFramePrintMeasure
): PrintTableMeasurement {
  const probe = document.createElement("div")
  // Use a definite width. Chromium clamps a shrink-to-fit absolute box to
  // the viewport, which under-measures a wide table.
  probe.style.position = "absolute"
  probe.style.visibility = "hidden"
  probe.style.left = "0"
  probe.style.top = "0"
  probe.style.width = PRINT_MEASURE_WIDTH
  probe.style.maxWidth = "none"
  // Inline styles, not a <style> element. A nonce-only style-src drops an
  // injected stylesheet, and CSSOM writes are still allowed.
  const copy = table.cloneNode(true)
  if (copy instanceof HTMLTableElement) {
    applyMeasureStyles(copy, measure)
  }
  probe.append(copy)
  document.body.append(probe)
  const laidOut = probe.querySelector("table")
  // beforeprint still uses screen media, so this copy is the only laid-out
  // table. The print slot itself is display:none and has no width.
  const width =
    laidOut instanceof HTMLTableElement ? getLaidOutWidth(laidOut) : 0
  const header =
    laidOut instanceof HTMLTableElement ? laidOut.rows[0] : undefined
  const columns =
    header instanceof HTMLTableRowElement
      ? // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- The print snapshot cannot wait for a resize observer
        [...header.cells].map(cell => cell.offsetWidth)
      : []
  probe.remove()
  return { width, columns }
}

/**
 * Whether print CSS can turn the column and table widths into a unitless ratio.
 *
 * Browsers that can do this keep the ratio in the stylesheet, where `100cqw`
 * follows the printed column. An inline scale would freeze the on-screen
 * column measured during `beforeprint`.
 */
function supportsPrintFontRatio(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("font-size", "calc(1px * min(1, tan(atan2(1px, 2px))))")
  )
}

function applyPrintScale(
  slot: HTMLElement,
  available: number,
  width: number
): void {
  // The stylesheet scales the font from the slot width. Leave that in
  // charge when the browser can compute it.
  if (supportsPrintFontRatio()) {
    slot.style.removeProperty(DATAFRAME_PRINT_SCALE_VAR)
    return
  }
  // No column width yet. Keep whatever ratio was recorded earlier.
  if (available <= 0 || width <= 0) {
    return
  }
  // The visible dataframe has a width while the slot is still display:none.
  // `min(1, ...)` keeps a table that already fits at its natural size.
  slot.style.setProperty(
    DATAFRAME_PRINT_SCALE_VAR,
    String(Math.min(1, available / width))
  )
}

function applyMeasureStyles(
  table: HTMLTableElement,
  measure: DataFramePrintMeasure
): void {
  table.style.borderCollapse = "collapse"
  table.style.width = "max-content"
  table.style.fontFamily = measure.fontFamily
  table.style.fontSize = measure.fontSize
  for (const cell of table.querySelectorAll("th, td")) {
    if (!(cell instanceof HTMLElement)) {
      continue
    }
    cell.style.whiteSpace = "nowrap"
    cell.style.padding = measure.padding
    cell.style.border = "0"
    cell.style.fontWeight = String(
      cell.tagName === "TH" ? measure.headerWeight : measure.cellWeight
    )
    cell.style.textAlign = "left"
  }
  for (const image of table.querySelectorAll("img")) {
    image.style.width = measure.imageWidth
    image.style.height = measure.imageHeight
    image.style.objectFit = "contain"
  }
}

function getLaidOutWidth(element: HTMLElement): number {
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- The print snapshot cannot wait for a resize observer
  return element.getBoundingClientRect().width
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
      if (content.kind === "images") {
        for (const url of content.urls) {
          const image = document.createElement("img")
          image.alt = ""
          image.src = url
          // The print snapshot can happen before this image loads. A remote
          // URL the grid has not already fetched may print as an empty box.
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

/** The canvas stays, and this says why the table was not expanded. */
function visiblePartNote(cellLimit: number): string {
  return cellLimit < DATAFRAME_PRINT_CELL_LIMIT
    ? "Only the on-screen part of this table is printed because other tables on this page were already expanded."
    : "Only the visible part of this table is printed because it is too large to expand."
}

/** Shown under a printed prefix. The row cap and the cell budget use different reasons. */
function rowCapNote(rowsToPrint: number, cellLimit: number): string {
  if (rowsToPrint === DATAFRAME_PRINT_ROW_LIMIT) {
    return `Further rows were not printed. This table is capped at ${DATAFRAME_PRINT_ROW_LIMIT.toLocaleString("en-US")} rows.`
  }
  return cellLimit < DATAFRAME_PRINT_CELL_LIMIT
    ? "Further rows were not printed because other tables on this page were already expanded."
    : "Further rows were not printed because this table is too large to print in full."
}

function printNote(message: string): HTMLParagraphElement {
  const note = document.createElement("p")
  note.className = DATAFRAME_PRINT_NOTE_CLASS
  note.textContent = message
  return note
}

function setPrintNote(slot: HTMLElement, message: string): void {
  slot.replaceChildren(printNote(message))
}
