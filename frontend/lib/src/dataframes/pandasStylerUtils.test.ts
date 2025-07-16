/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { describe, expect, test } from "vitest"

import { Quiver } from "./Quiver"
import { getStyledCell, getStyledHeaders } from "./pandasStylerUtils"

const T_FAKE_UUID = "T_FAKE_UUID"

describe("getStyledHeaders", () => {
  test("returns correct headers for single-level headers", () => {
    const mockQuiver = {
      dimensions: {
        numHeaderRows: 1,
        numIndexColumns: 1,
        numDataRows: 0,
        numDataColumns: 0,
        numRows: 1,
        numColumns: 2,
      },
      columnNames: [["", "col1", "col2"]],
    } as unknown as Quiver

    const headers = getStyledHeaders(mockQuiver)
    expect(headers).toEqual([
      [
        { name: "", cssClass: "blank index_name level0" },
        { name: "col1", cssClass: "col_heading level0 col0" },
        { name: "col2", cssClass: "col_heading level0 col1" },
      ],
    ])
  })

  test("returns correct headers for multi-level headers", () => {
    const mockQuiver = {
      dimensions: {
        numHeaderRows: 2,
        numIndexColumns: 2,
        numDataRows: 0,
        numDataColumns: 0,
        numRows: 2,
        numColumns: 4,
      },
      columnNames: [
        ["", "", "top1", "top2"],
        ["", "", "sub1", "sub2"],
      ],
    } as unknown as Quiver

    const headers = getStyledHeaders(mockQuiver)
    expect(headers).toEqual([
      [
        { name: "", cssClass: "blank index_name level0" },
        { name: "", cssClass: "blank index_name level0" },
        { name: "top1", cssClass: "col_heading level0 col0" },
        { name: "top2", cssClass: "col_heading level0 col1" },
      ],
      [
        { name: "", cssClass: "blank index_name level1" },
        { name: "", cssClass: "blank index_name level1" },
        { name: "sub1", cssClass: "col_heading level1 col0" },
        { name: "sub2", cssClass: "col_heading level1 col1" },
      ],
    ])
  })

  test("handles empty data", () => {
    const mockQuiver = {
      dimensions: {
        numHeaderRows: 1,
        numIndexColumns: 1,
        numDataRows: 0,
        numDataColumns: 0,
        numRows: 1,
        numColumns: 1,
      },
      columnNames: [[""]],
    } as unknown as Quiver

    const headers = getStyledHeaders(mockQuiver)
    expect(headers).toEqual([
      [{ name: "", cssClass: "blank index_name level0" }],
    ])
  })
})

describe("getStyledCell", () => {
  test("returns undefined when no styler is present", () => {
    const mockQuiver = {
      dimensions: {
        numHeaderRows: 1,
        numIndexColumns: 1,
        numDataRows: 2,
        numDataColumns: 2,
        numRows: 3,
        numColumns: 3,
      },
      styler: undefined,
    } as unknown as Quiver

    const cell = getStyledCell(mockQuiver, 0, 1)
    expect(cell).toBeUndefined()
  })

  test("returns correct styling for index cells", () => {
    const mockQuiver = {
      dimensions: {
        numHeaderRows: 1,
        numIndexColumns: 2,
        numDataRows: 3,
        numDataColumns: 2,
        numRows: 4,
        numColumns: 4,
      },
      styler: {
        cssId: T_FAKE_UUID,
      },
    } as unknown as Quiver

    const cell = getStyledCell(mockQuiver, 1, 0)
    expect(cell).toEqual({
      cssId: `${T_FAKE_UUID}_level0_row1`,
      cssClass: "row_heading level0 row1",
      displayContent: undefined,
    })
  })

  test("returns correct styling for data cells", () => {
    const mockQuiver = {
      dimensions: {
        numHeaderRows: 1,
        numIndexColumns: 1,
        numDataRows: 3,
        numDataColumns: 2,
        numRows: 4,
        numColumns: 3,
      },
      styler: {
        cssId: T_FAKE_UUID,
        displayValues: {
          getCell: (row: number, col: number) => ({
            content: `${row},${col}`,
          }),
        },
      },
    } as unknown as Quiver

    const cell = getStyledCell(mockQuiver, 1, 2)
    expect(cell).toEqual({
      cssId: `${T_FAKE_UUID}_row1_col1`,
      cssClass: "data row1 col1",
      displayContent: "1,2",
    })
  })

  test("throws error for out of range row index", () => {
    const mockQuiver = {
      dimensions: {
        numHeaderRows: 1,
        numIndexColumns: 1,
        numDataRows: 2,
        numDataColumns: 2,
        numRows: 3,
        numColumns: 3,
      },
      styler: {
        cssId: T_FAKE_UUID,
      },
    } as unknown as Quiver

    expect(() => getStyledCell(mockQuiver, 2, 1)).toThrow(
      "Row index is out of range: 2"
    )
  })

  test("throws error for out of range column index", () => {
    const mockQuiver = {
      dimensions: {
        numHeaderRows: 1,
        numIndexColumns: 1,
        numDataRows: 2,
        numDataColumns: 2,
        numRows: 3,
        numColumns: 3,
      },
      styler: {
        cssId: T_FAKE_UUID,
      },
    } as unknown as Quiver

    expect(() => getStyledCell(mockQuiver, 0, 3)).toThrow(
      "Column index is out of range: 3"
    )
  })
})
