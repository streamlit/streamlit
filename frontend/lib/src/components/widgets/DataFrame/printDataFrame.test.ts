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
import { genericFonts } from "~lib/theme/primitives/typography"

import { DATAFRAME_PRINT_TABLE_CLASS } from "./printClassNames"
import {
  clearDataFramePrintSlot,
  fillDataFramePrintSlot,
  isHiddenFromPrint,
  visibleRowsFromRegion,
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

describe("visibleRowsFromRegion", () => {
  it("uses the painted viewport when the grid has reported one", () => {
    expect(
      visibleRowsFromRegion({ x: 0, y: 10, width: 4, height: 5 }, 100)
    ).toEqual({ startRow: 10, rowCount: 5 })
  })

  it("falls back to every row when no viewport is known yet", () => {
    expect(visibleRowsFromRegion(null, 7)).toEqual({
      startRow: 0,
      rowCount: 7,
    })
  })

  it("caps the fallback for a large frame without a viewport", () => {
    expect(visibleRowsFromRegion(null, 1_000_000)).toEqual({
      startRow: 0,
      rowCount: 100,
    })
  })

  it("clamps a viewport that extends past the last row", () => {
    expect(
      visibleRowsFromRegion({ x: 0, y: 8, width: 2, height: 10 }, 10)
    ).toEqual({ startRow: 8, rowCount: 2 })
  })
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

  it("writes the visible rows, skipping hidden and button columns", () => {
    const columns = [
      column("Name"),
      column("Secret", { isHidden: true }),
      column("Go", { kind: "button" }),
      column("City"),
    ]
    const values = [
      ["Ada", "nope", "click", "London"],
      ["Grace", "nope", "click", "Boston"],
      ["Alan", "nope", "click", "Manchester"],
    ]

    fillDataFramePrintSlot(
      slot,
      columns,
      ([col, row]) => textCell(values[row][col]),
      { startRow: 1, rowCount: 2 }
    )

    const table = slot.querySelector("table")
    expect(table).toHaveClass(DATAFRAME_PRINT_TABLE_CLASS)
    expect(table).toHaveAttribute("data-testid", DATAFRAME_PRINT_TABLE_CLASS)
    expect(
      [...slot.querySelectorAll("th")].map(cell => cell.textContent)
    ).toEqual(["Name", "City"])
    expect(
      [...slot.querySelectorAll("td")].map(cell => cell.textContent)
    ).toEqual(["Grace", "Boston", "Alan", "Manchester"])
  })

  it("keeps an empty column title instead of falling back to the name", () => {
    fillDataFramePrintSlot(
      slot,
      [column("", { name: "col_a" })],
      () => textCell("Ada"),
      { startRow: 0, rowCount: 1 }
    )

    expect(slot.querySelector("th")?.textContent).toBe("")
  })

  it("prints the URL for a link cell that shows a Material icon", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Link", { kind: "link" })],
      () => ({
        kind: GridCellKind.Uri,
        data: "https://example.com",
        displayData: "\uE89E",
        allowOverlay: false,
        hoverEffect: true,
        themeOverride: { fontFamily: genericFonts.iconFont },
      }),
      { startRow: 0, rowCount: 1 }
    )

    expect(slot.querySelector("td")?.textContent).toBe("https://example.com")
  })

  it("prints a missing or empty icon-link cell without the icon", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Link", { kind: "link" })],
      ([, row]) =>
        row === 0
          ? {
              kind: GridCellKind.Uri,
              data: null as unknown as string,
              displayData: "",
              allowOverlay: false,
              hoverEffect: true,
              isMissingValue: true,
            }
          : {
              kind: GridCellKind.Uri,
              data: "",
              displayData: "",
              allowOverlay: false,
              hoverEffect: true,
              themeOverride: { fontFamily: genericFonts.iconFont },
            },
      { startRow: 0, rowCount: 2 }
    )

    expect(
      [...slot.querySelectorAll("td")].map(cell => cell.textContent)
    ).toEqual(["None", ""])
  })

  it("prints the formatted text instead of the stored value", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Share"), column("When")],
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
      { startRow: 0, rowCount: 1 }
    )

    expect(
      [...slot.querySelectorAll("td")].map(cell => cell.textContent)
    ).toEqual(["42%", "Oct 20, 2026"])
  })

  it("prints a checked box, an empty box, and a blank for a missing checkbox", () => {
    fillDataFramePrintSlot(
      slot,
      [column("On", { kind: "checkbox" })],
      ([, row]) => {
        if (row === 0) {
          return {
            kind: GridCellKind.Boolean,
            data: true,
            allowOverlay: false,
          }
        }
        if (row === 1) {
          return {
            kind: GridCellKind.Boolean,
            data: false,
            allowOverlay: false,
          }
        }
        return {
          kind: GridCellKind.Boolean,
          data: undefined,
          allowOverlay: false,
          isMissingValue: true,
        }
      },
      { startRow: 0, rowCount: 3 }
    )

    expect(
      [...slot.querySelectorAll("td")].map(cell => cell.textContent)
    ).toEqual(["\u2713", "\u2610", ""])
  })

  it("prints an image cell as an image instead of its URL", () => {
    const url = "data:image/png;base64,iVBORw0KGgo="
    fillDataFramePrintSlot(
      slot,
      [column("Picture", { kind: "image" })],
      () => ({
        kind: GridCellKind.Image,
        data: [url],
        displayData: [url],
        allowOverlay: false,
      }),
      { startRow: 0, rowCount: 1 }
    )

    const cell = slot.querySelector("td")
    expect(cell?.querySelector("img")).toHaveAttribute("src", url)
    expect(cell?.textContent).toBe("")
  })

  it("prints option labels for selectbox and multiselect cells", () => {
    fillDataFramePrintSlot(
      slot,
      [
        column("Size", { kind: "selectbox" }),
        column("Tags", { kind: "multiselect" }),
      ],
      ([col]) =>
        col === 0
          ? {
              kind: GridCellKind.Custom,
              allowOverlay: false,
              copyData: "s",
              data: {
                kind: "dropdown-cell",
                allowedValues: [null, { value: "s", label: "Small" }],
                value: "s",
              },
            }
          : {
              kind: GridCellKind.Custom,
              allowOverlay: false,
              copyData: "a,b",
              data: {
                kind: "multi-select-cell",
                options: [{ value: "a", label: "Alpha" }, { value: "b" }],
                values: ["a", "b"],
              },
            },
      { startRow: 0, rowCount: 1 }
    )

    expect(
      [...slot.querySelectorAll("td")].map(cell => cell.textContent)
    ).toEqual(["Small", "Alpha, b"])
  })

  it("falls back to copyData for custom cells without display text", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Clip", { kind: "audio" })],
      () => ({
        kind: GridCellKind.Custom,
        allowOverlay: false,
        copyData: "https://example.com/a.mp3",
        data: { kind: "audio-cell", src: "https://example.com/a.mp3" },
      }),
      { startRow: 0, rowCount: 1 }
    )

    expect(slot.querySelector("td")?.textContent).toBe(
      "https://example.com/a.mp3"
    )
  })

  it("escapes cell text through textContent", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      () => textCell("A & B <C>"),
      { startRow: 0, rowCount: 1 }
    )

    expect(slot.querySelector("td")?.textContent).toBe("A & B <C>")
  })

  it("prints a blank for a loading skeleton cell", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      () => ({
        kind: GridCellKind.Loading,
        allowOverlay: false,
        skeletonWidth: 60,
      }),
      { startRow: 0, rowCount: 1 }
    )

    expect(slot.querySelector("td")?.textContent).toBe("")
  })

  it("names the table when an accessible name is provided", () => {
    fillDataFramePrintSlot(
      slot,
      [column("Name")],
      () => textCell("Ada"),
      { startRow: 0, rowCount: 1 },
      { accessibleName: "People" }
    )

    expect(slot.querySelector("table")).toHaveAttribute("aria-label", "People")
  })

  it("clears the slot", () => {
    fillDataFramePrintSlot(slot, [column("Name")], () => textCell("Ada"), {
      startRow: 0,
      rowCount: 1,
    })
    clearDataFramePrintSlot(slot)
    expect(slot.childElementCount).toBe(0)
  })

  it("does nothing when there are no visible rows", () => {
    fillDataFramePrintSlot(slot, [column("Name")], () => textCell("Ada"), {
      startRow: 0,
      rowCount: 0,
    })
    expect(slot.childElementCount).toBe(0)
  })
})

describe("isHiddenFromPrint", () => {
  it("hides a dataframe inside a closed tab", () => {
    const host = document.createElement("div")
    host.setAttribute("data-st-inactive", "")
    const frame = document.createElement("div")
    host.append(frame)
    document.body.append(host)

    expect(isHiddenFromPrint(frame)).toBe(true)
    host.remove()
  })

  it("hides a dataframe inside a collapsed expander", () => {
    const details = document.createElement("details")
    const frame = document.createElement("div")
    details.append(frame)
    document.body.append(details)

    expect(isHiddenFromPrint(frame)).toBe(true)
    details.remove()
  })
})
