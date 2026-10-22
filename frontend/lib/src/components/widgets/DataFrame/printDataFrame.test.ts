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
import { vi } from "vitest"

import type { BaseColumn } from "~lib/components/widgets/DataFrame/columns"

import {
  buildDataFramePrintMeasure,
  clearDataFramePrintSlot,
  DATAFRAME_PRINT_CELL_LIMIT,
  DATAFRAME_PRINT_NOTE_CLASS,
  DATAFRAME_PRINT_TABLE_CLASS,
  DATAFRAME_PRINT_WIDTH_VAR,
  type DataFramePrintMeasure,
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

const measure: DataFramePrintMeasure = {
  fontFamily: "sans-serif",
  fontSize: "1rem",
  padding: "0.125rem 0.5rem",
  cellWeight: 400,
  headerWeight: 500,
}

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

    fillDataFramePrintSlot(
      slot,
      columns,
      1,
      ([col]) => textCell(values[col]),
      measure
    )

    const table = slot.querySelector("table")
    expect(table).toHaveClass(DATAFRAME_PRINT_TABLE_CLASS)
    expect(
      [...slot.querySelectorAll("th")].map(cell => cell.textContent)
    ).toEqual(["Name", "City"])
    expect(
      [...slot.querySelectorAll("td")].map(cell => cell.textContent)
    ).toEqual(["Ada", "London"])
  })

  it("prints the formatted text instead of the stored value", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Share"), column("When")],
      1,
      ([col]) => {
        if (col === 0) {
          return {
            kind: GridCellKind.Number,
            data: 0.42,
            displayData: "42%",
            allowOverlay: false,
          }
        }
        return {
          kind: GridCellKind.Custom,
          data: { kind: "date", displayDate: "Oct 20, 2026" },
          allowOverlay: false,
          copyData: "",
        }
      },
      measure
    )

    expect(
      [...slot.querySelectorAll("td")].map(cell => cell.textContent)
    ).toEqual(["42%", "Oct 20, 2026"])
  })

  it("escapes cell text", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      1,
      () => textCell("A & B <C>"),
      measure
    )

    expect(slot.querySelector("td")?.textContent).toBe("A & B <C>")
  })

  it("keeps the canvas when a row is still loading", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      2,
      ([, row]) =>
        row === 0
          ? textCell("Ada")
          : {
              kind: GridCellKind.Loading,
              allowOverlay: false,
              skeletonWidth: 60,
            },
      measure
    )

    expect(slot.querySelector("table")).toBeNull()
    expect(slot.querySelector("p")).toHaveClass(DATAFRAME_PRINT_NOTE_CLASS)
    expect(slot.textContent).toContain("still loading")
  })

  it("keeps the canvas when the frame is too large to expand", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      DATAFRAME_PRINT_CELL_LIMIT + 1,
      () => textCell("Ada"),
      measure
    )

    expect(slot.querySelector("table")).toBeNull()
    expect(slot.textContent).toContain("too large")
  })

  it("clears the table so the screen grid is restored after printing", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      1,
      () => textCell("Ada"),
      measure
    )
    slot.style.setProperty(DATAFRAME_PRINT_WIDTH_VAR, "10px")

    clearDataFramePrintSlot(slot)

    expect(slot.querySelector("table")).toBeNull()
    expect(slot.style.getPropertyValue(DATAFRAME_PRINT_WIDTH_VAR)).toBe("")
  })

  it("prints an empty progress or chart cell as blank", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Name"), column("Progress")],
      1,
      ([col]) =>
        col === 0
          ? textCell("Ada")
          : { kind: GridCellKind.Loading, allowOverlay: false, copyData: "" },
      measure
    )

    expect(slot.querySelector("table")).not.toBeNull()
    expect(
      [...slot.querySelectorAll("td")].map(cell => cell.textContent)
    ).toEqual(["Ada", ""])
  })

  it("measures the laid-out table, including its font", () => {
    let css = ""
    const spy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation(function width(this: HTMLElement) {
        if (this.tagName === "TABLE") {
          css = this.parentElement?.querySelector("style")?.textContent ?? ""
          return 320
        }
        return 0
      })

    fillDataFramePrintSlot(slot, [column("Name")], 1, () => textCell("Ada"), {
      fontFamily: "Custom, sans-serif",
      fontSize: "1.5rem",
      padding: "0.25rem 1rem",
      cellWeight: 400,
      headerWeight: 500,
    })

    expect(css).toContain("Custom, sans-serif")
    expect(css).toContain("1.5rem")
    expect(css).toContain("0.25rem 1rem")
    expect(slot.style.getPropertyValue(DATAFRAME_PRINT_WIDTH_VAR)).toBe(
      "320px"
    )
    spy.mockRestore()
  })
})

describe("buildDataFramePrintMeasure", () => {
  it("uses the theme font and cell spacing", () => {
    expect(
      buildDataFramePrintMeasure({
        fontSizes: { md: "1rem" },
        fontWeights: { normal: 400, semiBold: 500 },
        genericFonts: { bodyFont: "Custom, sans-serif" },
        spacing: { threeXS: "0.125rem", sm: "0.5rem" },
      })
    ).toEqual({
      fontFamily: "Custom, sans-serif",
      fontSize: "1rem",
      padding: "0.125rem 0.5rem",
      cellWeight: 400,
      headerWeight: 500,
    })
  })
})
