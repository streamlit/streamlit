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

import { type GridCell, GridCellKind } from "@glideapps/glide-data-grid"

import type { BaseColumn } from "~lib/components/widgets/DataFrame/columns"

import {
  clearDataFramePrintSlot,
  DATAFRAME_PRINT_TABLE_CLASS,
  DATAFRAME_PRINT_WIDTH_VAR,
  fillDataFramePrintSlot,
} from "./printDataFrame"

function column(
  title: string,
  overrides: Partial<BaseColumn> = {}
): BaseColumn {
  return {
    title,
    name: title,
    isHidden: false,
    kind: "text",
    getCellValue: (cell: GridCell) =>
      "displayData" in cell ? cell.displayData : "",
    ...overrides,
  } as BaseColumn
}

const textCell = (displayData: string): GridCell => ({
  kind: GridCellKind.Text,
  displayData,
  data: displayData,
  allowOverlay: false,
})

describe("fillDataFramePrintSlot", () => {
  let slot: HTMLDivElement

  beforeEach(() => {
    slot = document.createElement("div")
    document.body.appendChild(slot)
  })

  afterEach(() => {
    slot.remove()
  })

  it("writes every visible cell, skipping hidden and button columns", () => {
    const columns = [
      column("Name"),
      column("Secret", { isHidden: true }),
      column("Go", { kind: "button" }),
      column("City"),
    ]
    const values = ["Ada", "nope", "click", "London"]

    fillDataFramePrintSlot(slot, columns, 1, ([col]) => textCell(values[col]))

    const table = slot.querySelector("table")
    expect(table).toHaveClass(DATAFRAME_PRINT_TABLE_CLASS)
    expect(
      [...slot.querySelectorAll("th")].map(cell => cell.textContent)
    ).toEqual(["Name", "City"])
    expect(
      [...slot.querySelectorAll("td")].map(cell => cell.textContent)
    ).toEqual(["Ada", "London"])
  })

  it("clears the table so the screen grid is restored after printing", () => {
    fillDataFramePrintSlot(slot, [column("Name")], 1, () => textCell("Ada"))
    slot.style.setProperty(DATAFRAME_PRINT_WIDTH_VAR, "10px")

    clearDataFramePrintSlot(slot)

    expect(slot.querySelector("table")).toBeNull()
    expect(slot.style.getPropertyValue(DATAFRAME_PRINT_WIDTH_VAR)).toBe("")
  })
})
