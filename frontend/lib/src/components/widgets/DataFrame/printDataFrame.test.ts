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
  isHiddenFromPrint,
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
  imageWidth: "4rem",
  imageHeight: "2rem",
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
    expect(slot.textContent).not.toContain("on-screen grid")
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
    let probeWidth = ""
    const spy = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockImplementation(function width(this: HTMLElement) {
        if (this.tagName === "TABLE") {
          css = this.parentElement?.querySelector("style")?.textContent ?? ""
          probeWidth = this.parentElement?.style.maxWidth ?? ""
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
      imageWidth: "4rem",
      imageHeight: "2rem",
    })

    expect(css).toContain("Custom, sans-serif")
    expect(css).toContain("1.5rem")
    expect(css).toContain("0.25rem 1rem")
    expect(css).toContain("width: 4rem")
    expect(css).toContain("height: 2rem")
    // width:max-content is set too. jsdom drops that keyword, so the
    // companion max-width:none is what this environment can observe.
    expect(probeWidth).toBe("none")
    expect(slot.style.getPropertyValue(DATAFRAME_PRINT_WIDTH_VAR)).toBe(
      "320px"
    )
    spy.mockRestore()
  })

  it("prints select labels, media sources, formatted sparklines, and images", () => {
    fillDataFramePrintSlot(
      slot,
      [
        column("Choice"),
        column("Clip"),
        column("Trend"),
        column("Photo"),
        column("Tags"),
      ],
      1,
      ([col]) => {
        if (col === 0) {
          return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: "a",
            data: {
              kind: "dropdown-cell",
              value: "a",
              allowedValues: [{ value: "a", label: "Alpha" }, "b"],
            },
          }
        }
        if (col === 1) {
          return {
            kind: GridCellKind.Custom,
            allowOverlay: false,
            copyData: "",
            data: {
              kind: "media-cell",
              mediaType: "audio",
              src: "https://example.com/a.mp3",
            },
          }
        }
        if (col === 2) {
          return {
            kind: GridCellKind.Custom,
            allowOverlay: false,
            copyData: "",
            data: {
              kind: "sparkline-cell",
              values: [0, 1],
              displayValues: ["0", "1.5"],
            },
          }
        }
        if (col === 3) {
          return {
            kind: GridCellKind.Image,
            data: ["data:image/png;base64,aaaa"],
            displayData: ["data:image/png;base64,aaaa"],
            allowOverlay: true,
          }
        }
        return {
          kind: GridCellKind.Custom,
          allowOverlay: false,
          copyData: "",
          data: { kind: "list-cell", values: ["red", "blue"] },
        }
      },
      measure
    )

    const cells = [...slot.querySelectorAll("td")]
    expect(cells.map(cell => cell.textContent)).toEqual([
      "Alpha",
      "https://example.com/a.mp3",
      "0, 1.5",
      "",
      "red, blue",
    ])
    expect(cells[3].querySelector("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,aaaa"
    )
    expect(slot.innerHTML).not.toContain("base64,aaaa</")
  })
})

describe("isHiddenFromPrint", () => {
  it("treats a closed tab and a collapsed expander as unprinted", () => {
    const tab = document.createElement("div")
    tab.setAttribute("data-st-inactive", "")
    const frame = document.createElement("div")
    tab.append(frame)
    expect(isHiddenFromPrint(frame)).toBe(true)

    const details = document.createElement("details")
    const hidden = document.createElement("div")
    details.append(hidden)
    expect(isHiddenFromPrint(hidden)).toBe(true)

    details.open = true
    expect(isHiddenFromPrint(hidden)).toBe(false)
  })
})

describe("buildDataFramePrintMeasure", () => {
  it("uses the theme font and cell spacing", () => {
    expect(
      buildDataFramePrintMeasure({
        fontSizes: { md: "1rem" },
        fontWeights: { normal: 400, semiBold: 500 },
        genericFonts: { bodyFont: "Custom, sans-serif" },
        spacing: {
          threeXS: "0.125rem",
          sm: "0.5rem",
          threeXL: "2rem",
          fourXL: "4rem",
        },
      })
    ).toEqual({
      fontFamily: "Custom, sans-serif",
      fontSize: "1rem",
      padding: "0.125rem 0.5rem",
      cellWeight: 400,
      headerWeight: 500,
      imageWidth: "4rem",
      imageHeight: "2rem",
    })
  })
})
