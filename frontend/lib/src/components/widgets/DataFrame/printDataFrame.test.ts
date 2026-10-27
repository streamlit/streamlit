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
  DATAFRAME_PRINT_NOTE_CLASS,
  DATAFRAME_PRINT_SCALE_CLASS,
  DATAFRAME_PRINT_TABLE_CLASS,
  DATAFRAME_PRINT_WIDTH_VAR,
} from "./printClassNames"
import {
  buildDataFramePrintMeasure,
  clearDataFramePrintSlot,
  DATAFRAME_PRINT_CELL_LIMIT,
  DATAFRAME_PRINT_IMAGE_LIMIT,
  DATAFRAME_PRINT_ROW_LIMIT,
  dataFramePrintBudget,
  type DataFramePrintMeasure,
  fillDataFramePrintSlot,
  fitDataFramePrintTable,
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

  it("keeps the canvas when one row does not fit in the cell budget", () => {
    fillDataFramePrintSlot(
      slot,
      Array.from({ length: DATAFRAME_PRINT_CELL_LIMIT + 1 }, () =>
        column("Name")
      ),
      1,
      () => textCell("Ada"),
      measure
    )

    expect(slot.querySelector("table")).toBeNull()
    expect(slot.textContent).toContain(
      "Only the visible part of this table is printed because it is too large to expand."
    )
    expect(slot.textContent).not.toContain("Further rows")
  })

  it("prints the first 1000 rows and a note when the frame is longer", () => {
    const budget = { remaining: DATAFRAME_PRINT_CELL_LIMIT }
    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      DATAFRAME_PRINT_ROW_LIMIT + 1,
      ([, row]) => textCell(`row-${row}`),
      measure,
      budget
    )

    const bodyRows = slot.querySelectorAll("tbody tr")
    expect(bodyRows).toHaveLength(DATAFRAME_PRINT_ROW_LIMIT)
    expect(bodyRows[DATAFRAME_PRINT_ROW_LIMIT - 1]).toHaveTextContent(
      `row-${DATAFRAME_PRINT_ROW_LIMIT - 1}`
    )
    expect(slot.textContent).not.toContain(`row-${DATAFRAME_PRINT_ROW_LIMIT}`)
    const note = slot.querySelector("p")
    expect(note).toHaveClass(DATAFRAME_PRINT_NOTE_CLASS)
    expect(note).toHaveTextContent(
      "Further rows were not printed. This table is capped at 1,000 rows."
    )
    expect(
      slot.querySelector(`.${DATAFRAME_PRINT_SCALE_CLASS}`)?.nextElementSibling
    ).toBe(note)
    expect(budget.remaining).toBe(
      DATAFRAME_PRINT_CELL_LIMIT - DATAFRAME_PRINT_ROW_LIMIT
    )
  })

  it("prints a shorter prefix when the page cell budget runs out", () => {
    const budget = { remaining: 3 }
    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      5,
      ([, row]) => textCell(`row-${row}`),
      measure,
      budget
    )

    expect(slot.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(slot.textContent).toContain("row-2")
    expect(slot.textContent).not.toContain("row-3")
    expect(slot.querySelector("p")).toHaveTextContent(
      "Further rows were not printed because this page already expanded too many cells."
    )
    expect(slot.textContent).not.toContain("visible part")
    expect(budget.remaining).toBe(0)
  })

  it("does not cap a table that fits the row limit and the cell budget", () => {
    const budget = { remaining: 10 }
    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      3,
      ([, row]) => textCell(`row-${row}`),
      measure,
      budget
    )

    expect(slot.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(slot.querySelector("p")).toBeNull()
    expect(budget.remaining).toBe(7)
  })

  it("shares one print budget across frames and gives it back if a row is loading", () => {
    const budget = dataFramePrintBudget(new Event("beforeprint"))
    budget.remaining = 2

    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      1,
      () => textCell("Ada"),
      measure,
      budget
    )
    expect(slot.querySelector("table")).not.toBeNull()
    expect(budget.remaining).toBe(1)

    const second = document.createElement("div")
    document.body.appendChild(second)
    fillDataFramePrintSlot(
      second,
      [column("Name"), column("City")],
      1,
      () => textCell("Ada"),
      measure,
      budget
    )
    expect(second.querySelector("table")).toBeNull()
    expect(second.textContent).toContain("already expanded too many cells")
    expect(second.textContent).not.toContain("too large")
    expect(budget.remaining).toBe(1)
    second.remove()

    const loading = document.createElement("div")
    document.body.appendChild(loading)
    const loadingBudget = { remaining: 2 }
    fillDataFramePrintSlot(
      loading,
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
      measure,
      loadingBudget
    )
    expect(loading.querySelector("table")).toBeNull()
    expect(loadingBudget.remaining).toBe(2)
    loading.remove()

    const again = dataFramePrintBudget(new Event("beforeprint"))
    expect(again.remaining).toBe(DATAFRAME_PRINT_CELL_LIMIT)
    expect(again).not.toBe(budget)
  })

  it("scales a wide table with a unitless zoom when the slot already has a width", () => {
    Object.defineProperty(slot, "clientWidth", { value: 80 })
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function width(this: HTMLElement) {
        if (this.tagName === "TABLE") {
          return {
            x: 0,
            y: 0,
            width: 320,
            height: 0,
            top: 0,
            right: 320,
            bottom: 0,
            left: 0,
            toJSON: () => ({}),
          }
        }
        return {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        }
      })

    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      1,
      () => textCell("Ada"),
      measure
    )

    const scale = slot.querySelector(`.${DATAFRAME_PRINT_SCALE_CLASS}`)
    const table = slot.querySelector("table")
    expect(scale?.contains(table)).toBe(true)
    expect(scale).toHaveProperty("style.zoom", "0.25")
    // Zoom on the table does not shrink Chromium's border box.
    expect(table?.getAttribute("style") ?? "").not.toContain("zoom")
    spy.mockRestore()
  })

  it("scales from the visible dataframe when the print slot has no width", () => {
    const frame = document.createElement("div")
    frame.className = "stDataFrame"
    let frameWidth = 80
    Object.defineProperty(frame, "clientWidth", { get: () => frameWidth })
    Object.defineProperty(slot, "clientWidth", { value: 0 })
    frame.append(slot)
    document.body.append(frame)
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function width(this: HTMLElement) {
        if (this.tagName === "TABLE") {
          return {
            x: 0,
            y: 0,
            width: 320,
            height: 0,
            top: 0,
            right: 320,
            bottom: 0,
            left: 0,
            toJSON: () => ({}),
          }
        }
        return {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        }
      })

    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      1,
      () => textCell("Ada"),
      measure
    )

    const scale = slot.querySelector(`.${DATAFRAME_PRINT_SCALE_CLASS}`)
    expect(scale).toHaveProperty("style.zoom", "0.25")
    frameWidth = 160
    fitDataFramePrintTable(slot)
    expect(scale).toHaveProperty("style.zoom", "0.5")
    // A stacked print column is wider than the table. The on-screen zoom
    // has to come off, or the table stays shrunk inside that column.
    frameWidth = 400
    fitDataFramePrintTable(slot)
    expect(scale).toHaveProperty("style.zoom", "")
    spy.mockRestore()
    frame.remove()
  })

  it("refits from the printed columns when they are wider than the probe", () => {
    const frame = document.createElement("div")
    frame.className = "stDataFrame"
    Object.defineProperty(frame, "clientWidth", { get: () => 80 })
    Object.defineProperty(slot, "clientWidth", { value: 0 })
    frame.append(slot)
    document.body.append(frame)
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function width(this: HTMLElement) {
        if (this.tagName === "TABLE") {
          return {
            x: 0,
            y: 0,
            width: 320,
            height: 0,
            top: 0,
            right: 320,
            bottom: 0,
            left: 0,
            toJSON: () => ({}),
          }
        }
        return {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        }
      })

    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      1,
      () => textCell("Ada"),
      measure
    )
    const table = slot.querySelector("table")
    expect(table).not.toBeNull()
    if (!(table instanceof HTMLTableElement)) {
      throw new Error("print table missing")
    }
    vi.spyOn(table, "offsetWidth", "get").mockReturnValue(480)
    vi.spyOn(table.rows[0].cells[0], "offsetWidth", "get").mockReturnValue(480)

    fitDataFramePrintTable(slot)

    const scale = slot.querySelector(`.${DATAFRAME_PRINT_SCALE_CLASS}`)
    expect(slot.style.getPropertyValue(DATAFRAME_PRINT_WIDTH_VAR)).toBe(
      "480px"
    )
    expect(scale).toHaveProperty("style.zoom", String(80 / 480))
    expect(table.style.tableLayout).toBe("fixed")
    expect(table.querySelector("col")?.style.width).toBe("480px")
    spy.mockRestore()
    frame.remove()
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
    let sawStyleElement = false
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function width(this: HTMLElement) {
        if (this.tagName === "TABLE") {
          css = [
            this.style.cssText,
            this.querySelector("th")?.style.cssText ?? "",
            this.querySelector("img")?.style.cssText ?? "",
          ].join(" ")
          sawStyleElement = this.parentElement?.querySelector("style") !== null
          probeWidth = this.parentElement?.style.width ?? ""
          return {
            x: 0,
            y: 0,
            width: 320,
            height: 0,
            top: 0,
            right: 320,
            bottom: 0,
            left: 0,
            toJSON: () => ({}),
          }
        }
        return {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        }
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

    expect(sawStyleElement).toBe(false)
    expect(css).toContain("Custom, sans-serif")
    expect(css).toContain("1.5rem")
    expect(css).toContain("0.25rem 1rem")
    expect(probeWidth).toBe("100000px")
    expect(slot.style.getPropertyValue(DATAFRAME_PRINT_WIDTH_VAR)).toBe(
      "320px"
    )
    spy.mockRestore()
  })

  it("prints a multi-level header with its group", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Revenue", { group: "East / Sales" })],
      1,
      () => textCell("1"),
      measure
    )

    expect(slot.querySelector("th")?.textContent).toBe(
      "East / Sales / Revenue"
    )
  })

  it("keeps the canvas when a frame has too many images", () => {
    const budget = dataFramePrintBudget(new Event("beforeprint"))
    fillDataFramePrintSlot(
      slot,
      [column("Photo", { kind: "image" })],
      DATAFRAME_PRINT_IMAGE_LIMIT + 1,
      () => ({
        kind: GridCellKind.Image,
        data: ["data:image/png;base64,aaaa"],
        displayData: ["data:image/png;base64,aaaa"],
        allowOverlay: true,
      }),
      measure,
      budget
    )

    expect(slot.querySelector("table")).toBeNull()
    expect(slot.querySelector("img")).toBeNull()
    expect(slot.textContent).toContain("too many images")
    expect(budget.remaining).toBe(DATAFRAME_PRINT_CELL_LIMIT)
  })

  it("prints formatted values, option labels, and link targets", () => {
    fillDataFramePrintSlot(
      slot,
      [
        column("Choice"),
        column("Clip"),
        column("Trend"),
        column("Photo"),
        column("Tags"),
        column("Teams"),
        column("Link"),
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
        if (col === 4) {
          return {
            kind: GridCellKind.Custom,
            allowOverlay: false,
            copyData: "",
            data: { kind: "list-cell", values: ["red", "blue"] },
          }
        }
        if (col === 5) {
          return {
            kind: GridCellKind.Custom,
            allowOverlay: false,
            copyData: "",
            data: {
              kind: "multi-select-cell",
              values: ["a", "other"],
              options: [{ value: "a", label: "Alpha" }],
            },
          }
        }
        return {
          kind: GridCellKind.Uri,
          allowOverlay: false,
          data: "https://streamlit.io",
          displayData: "open_in_new",
          themeOverride: { fontFamily: "Material Symbols Rounded" },
          onClickUri: () => {},
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
      "Alpha, other",
      "https://streamlit.io",
    ])
    expect(cells[3].querySelector("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,aaaa"
    )
    expect(slot.innerHTML).not.toContain("base64,aaaa</")
  })

  it("prints a short label for a data URL in an audio or video cell", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Clip"), column("Film")],
      1,
      ([col]) => ({
        kind: GridCellKind.Custom,
        allowOverlay: false,
        copyData: "",
        data: {
          kind: "media-cell",
          mediaType: col === 0 ? "audio" : "video",
          src:
            col === 0
              ? "data:audio/wav;base64,AAAA"
              : "data:video/mp4;base64,BBBB",
        },
      }),
      measure
    )

    const cells = [...slot.querySelectorAll("td")]
    expect(cells.map(cell => cell.textContent)).toEqual(["Audio", "Video"])
    expect(slot.innerHTML).not.toContain("base64")
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

  it("treats a collapsed sidebar as unprinted", () => {
    const sidebar = document.createElement("section")
    sidebar.setAttribute("data-collapsed", "true")
    const frame = document.createElement("div")
    sidebar.append(frame)
    expect(isHiddenFromPrint(frame)).toBe(true)

    sidebar.setAttribute("data-collapsed", "false")
    expect(isHiddenFromPrint(frame)).toBe(false)
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
