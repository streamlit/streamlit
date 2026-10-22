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

import type { GridCell, Item } from "@glideapps/glide-data-grid"

import {
  type BaseColumn,
  toSafeString,
} from "~lib/components/widgets/DataFrame/columns"

/** Class of the HTML table that replaces the canvas grid when printing. */
export const DATAFRAME_PRINT_TABLE_CLASS = "stDataFramePrintTable"

/**
 * Natural width of that table, measured before it is scaled down to the page.
 * The print stylesheet divides the column width by this length.
 */
export const DATAFRAME_PRINT_WIDTH_VAR = "--st-df-print-width"

/**
 * Build a table of every visible cell and remember how wide it is.
 *
 * The on-screen grid is a canvas of the viewport, so columns that sit past
 * the scroll edge are never painted. Printing that canvas cuts them off.
 * This table is the whole frame. Print CSS scales it down to the page, and a
 * PDF viewer can zoom back in.
 */
export function fillDataFramePrintSlot(
  slot: HTMLElement,
  columns: readonly BaseColumn[],
  numRows: number,
  getCellContent: (cell: Item) => GridCell
): void {
  clearDataFramePrintSlot(slot)

  const printable = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => !column.isHidden && column.kind !== "button")
  if (printable.length === 0 || numRows <= 0) {
    return
  }

  const table = document.createElement("table")
  table.className = DATAFRAME_PRINT_TABLE_CLASS
  table.style.borderCollapse = "collapse"
  table.style.width = "max-content"
  table.style.font = getComputedStyle(slot).font

  const headerRow = document.createElement("tr")
  printable.forEach(({ column }) => {
    const header = document.createElement("th")
    header.textContent = column.title || column.name
    applyPrintCellStyle(header, true)
    headerRow.appendChild(header)
  })
  const thead = document.createElement("thead")
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement("tbody")
  for (let row = 0; row < numRows; row++) {
    const bodyRow = document.createElement("tr")
    printable.forEach(({ column, index }) => {
      const cell = document.createElement("td")
      cell.textContent = toSafeString(
        column.getCellValue(getCellContent([index, row]))
      )
      applyPrintCellStyle(cell, false)
      bodyRow.appendChild(cell)
    })
    tbody.appendChild(bodyRow)
  }
  table.appendChild(tbody)

  slot.appendChild(table)
  // The scale is the column width divided by this size. Zoom changes the
  // table's layout width, so the first reading is a little short and the
  // scaled table paints past the column. Measure again with that scale in
  // place until the width settles.
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- print snapshot cannot wait for a resize observer
  let width = table.offsetWidth
  for (let pass = 0; pass < 4 && width > 0; pass++) {
    slot.style.setProperty(DATAFRAME_PRINT_WIDTH_VAR, `${width}px`)
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- print snapshot cannot wait for a resize observer
    const laidOut = table.offsetWidth
    if (laidOut === width) {
      break
    }
    width = laidOut
  }
}

/** Drop the print table so the on-screen grid is unchanged after printing. */
export function clearDataFramePrintSlot(slot: HTMLElement): void {
  slot.replaceChildren()
  slot.style.removeProperty(DATAFRAME_PRINT_WIDTH_VAR)
}

function applyPrintCellStyle(cell: HTMLElement, isHeader: boolean): void {
  cell.style.whiteSpace = "nowrap"
  cell.style.padding = "2px 8px"
  cell.style.border = "1px solid rgba(49, 51, 63, 0.2)"
  cell.style.textAlign = "left"
  cell.style.fontWeight = isHeader ? "600" : "400"
}
