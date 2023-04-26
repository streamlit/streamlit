/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"

import {
  getErrorCell,
  isErrorCell,
  getEmptyCell,
  getTextCell,
  toSafeArray,
  toSafeString,
  toSafeNumber,
  formatNumber,
  mergeColumnParameters,
  isMissingValueCell,
  BaseColumnProps,
  toSafeBoolean,
  toGlideColumn,
  toSafeDate,
} from "./utils"
import { TextColumn } from "."

const MOCK_TEXT_COLUMN_PROPS = {
  id: "column_1",
  name: "column_1",
  title: "column_1",
  indexNumber: 0,
  arrowType: {
    pandas_type: "unicode",
    numpy_type: "object",
  },
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
} as BaseColumnProps

describe("getErrorCell", () => {
  it("creates a valid error cell", () => {
    const errorCell = getErrorCell("Foo Error", "Lorem Ipsum Dolor")
    expect(errorCell.kind).toEqual(GridCellKind.Text)
    expect(errorCell.readonly).toEqual(true)
    expect(errorCell.allowOverlay).toEqual(true)
    expect(errorCell.displayData).toEqual("⚠️ Foo Error")
    expect(errorCell.data).toEqual("⚠️ Foo Error\n\nLorem Ipsum Dolor\n")
    expect(errorCell.isError).toEqual(true)
  })
})

describe("isErrorCell", () => {
  it("detects error cells", () => {
    const errorCell = getErrorCell("Foo Error")
    expect(isErrorCell(errorCell)).toEqual(true)

    const textCell: GridCell = {
      kind: GridCellKind.Text,
      displayData: "foo",
      data: "foo",
      allowOverlay: true,
    }
    expect(isErrorCell(textCell)).toEqual(false)
  })
})

describe("getEmptyCell", () => {
  it("creates a valid empty cell", () => {
    const emptyCell = getEmptyCell()
    expect(emptyCell.kind).toEqual(GridCellKind.Loading)
    expect(emptyCell.allowOverlay).toEqual(false)
  })
})

describe("getTextCell", () => {
  it("creates a valid read-only text cell", () => {
    const textCell = getTextCell(true, false)
    expect(textCell.kind).toEqual(GridCellKind.Text)
    expect(textCell.readonly).toEqual(true)
    expect(textCell.allowOverlay).toEqual(true)
    expect(textCell.displayData).toEqual("")
    expect(textCell.data).toEqual("")
  })
})

describe("toSafeArray", () => {
  it.each([
    [null, []],
    [undefined, []],
    ["", []],
    ["foo", ["foo"]],
    // Comma separated syntax
    ["foo,bar", ["foo", "bar"]],
    ["foo,bar,", ["foo", "bar", ""]],
    ["foo,bar,,", ["foo", "bar", "", ""]],
    // JSON Array syntax
    [`["foo","bar"]`, ["foo", "bar"]],
    // non-string values
    [0, [0]],
    [1, [1]],
    [
      [0, 1.2],
      [0, 1.2],
    ],
    [true, [true]],
    [false, [false]],
    [
      [true, false],
      [true, false],
    ],
  ])("converts %p to a valid array: %p", (input, expected) => {
    expect(toSafeArray(input)).toEqual(expected)
  })
})

describe("toSafeString", () => {
  it.each([
    [null, ""],
    [undefined, ""],
    [[], ""],
    ["", ""],
    ["foo", "foo"],
    ["abc def 1234 $", "abc def 1234 $"],
    [0, "0"],
    [1, "1"],
    [0.123, "0.123"],
    [true, "true"],
    [false, "false"],
    [["foo", "bar"], "foo,bar"],
    [[1, 2, 0.1231], "1,2,0.1231"],
    [
      {
        foo: "bar",
      },
      "[object Object]",
    ],
  ])("converts %p to a valid string: %p", (input, expected) => {
    expect(toSafeString(input)).toEqual(expected)
  })
})

describe("toSafeBoolean", () => {
  it.each([
    [true, true],
    [false, false],
    ["true", true],
    ["false", false],
    ["yes", true],
    ["no", false],
    ["t", true],
    ["f", false],
    ["y", true],
    ["n", false],
    ["on", true],
    ["off", false],
    ["1", true],
    ["0", false],
    [1, true],
    [0, false],
    [[], null],
    [null, null],
    [undefined, null],
    ["", null],
    ["foo", undefined],
    [12345, undefined],
    [[1, 2], undefined],
    [0.1, undefined],
  ])("converts %p to a boolean: %p", (input, expected) => {
    expect(toSafeBoolean(input)).toEqual(expected)
  })
})

describe("toSafeNumber", () => {
  it.each([
    [null, null],
    [undefined, null],
    ["", null],
    ["foo", NaN],
    [["foo"], NaN],
    [
      {
        foo: "bar",
      },
      NaN,
    ],
    [[], NaN],
    ["123", 123],
    ["123 ", 123],
    [" 123 ", 123],
    [" 123", 123],
    ["123.456", 123.456],
    ["123,456", 123456],
    ["123,456.789", 123456.789],
    ["123,456,789", 123456789],
    ["123,456,789.123", 123456789.123],
    ["4.12", 4.12],
    ["-4.12", -4.12],
    [1.3122, 1.3122],
    [123, 123],
    ["1,212.12", 1212.12],
    [".1312314", 0.1312314],
    [true, 1],
    [false, 0],
  ])("converts %p to a valid number: %p", (input, expected) => {
    expect(toSafeNumber(input)).toEqual(expected)
  })
})

describe("formatNumber", () => {
  it.each([
    [10, 0, "10"],
    [10.123, 0, "10"],
    [10.123, 1, "10.1"],
    [10.123, 2, "10.12"],
    [10.123, 3, "10.123"],
    [10.123, 4, "10.123"],
    [10.123, 5, "10.123"],
    [0.123, 0, "0"],
    [0.123, 1, "0.1"],
  ])("formats %p to %p with %p decimals", (value, decimals, expected) => {
    expect(formatNumber(value, decimals)).toEqual(expected)
  })

  it.each([
    [10, 0, "10"],
    [10, 4, "10.0000"],
    [10.123, 0, "10"],
    [10.123, 1, "10.1"],
    [10.123, 2, "10.12"],
    [10.123, 3, "10.123"],
    [10.123, 4, "10.1230"],
    [10.123, 5, "10.12300"],
    [0.123, 0, "0"],
    [0.123, 1, "0.1"],
  ])(
    "formats %p to %p with %p decimals (keeps trailing zeros)",
    (value, decimals, expected) => {
      expect(formatNumber(value, decimals, true)).toEqual(expected)
    }
  )
})

describe("mergeColumnParameters", () => {
  it("should merge the default and user parameters", () => {
    const defaultParams = {
      foo: "bar",
      bar: "baz",
    }
    const userParams = {
      foo: "baz",
      baz: "qux",
    }
    const mergedParams = mergeColumnParameters(defaultParams, userParams)
    expect(mergedParams).toEqual({
      foo: "baz",
      bar: "baz",
      baz: "qux",
    })
  })
})

describe("isMissingValueCell", () => {
  it("detects if a cell has a missing value", () => {
    const textColumn = TextColumn(MOCK_TEXT_COLUMN_PROPS)

    expect(isMissingValueCell(textColumn.getCell(null))).toBe(true)
    expect(isMissingValueCell(textColumn.getCell("foo"))).toBe(false)
  })
})

describe("toGlideColumn", () => {
  it("should convert form our BaseColumn to a glide-data-grid compatible column", () => {
    const textColumn = TextColumn(MOCK_TEXT_COLUMN_PROPS)
    const glideColumn = toGlideColumn(textColumn)

    expect(glideColumn).toEqual({
      id: MOCK_TEXT_COLUMN_PROPS.id,
      title: MOCK_TEXT_COLUMN_PROPS.title,
      hasMenu: false,
      themeOverride: MOCK_TEXT_COLUMN_PROPS.themeOverride,
      grow: undefined,
      width: undefined,
    })
  })

  it("should set the correct grow based on the isStretched config", () => {
    const textColumn = TextColumn({
      ...MOCK_TEXT_COLUMN_PROPS,
      isStretched: true,
    })

    expect(toGlideColumn(textColumn).grow).toEqual(3)

    // Create index column:
    const indexColumn = TextColumn({
      ...MOCK_TEXT_COLUMN_PROPS,
      isStretched: true,
      isIndex: true,
    })

    expect(toGlideColumn(indexColumn).grow).toEqual(1)
  })
})

function getTodayIsoDate(): string {
  return new Date().toISOString().split("T")[0]
}

describe("toSafeDate", () => {
  it.each([
    // valid date object
    [new Date("2023-04-25"), new Date("2023-04-25")],
    // undefined value
    [undefined, null],
    // null value
    [null, null],
    // empty string
    ["", null],
    // invalid number
    [NaN, undefined],
    // invalid string
    ["foo", undefined],
    // valid date string
    ["2023-04-25", new Date("2023-04-25")],
    // valid unix timestamp in seconds
    [1671951600, new Date("2022-12-25T07:00:00.000Z")],
    // valid bigint timestamp in seconds
    [BigInt(1671951600), new Date("2022-12-25T07:00:00.000Z")],
    // other date formats:
    ["04/25/2023", new Date("2023-04-25T00:00:00.000Z")],
    // invalid string
    ["invalid date", undefined],
    // valid ISO date string
    ["2023-04-25T10:30:00.000Z", new Date("2023-04-25T10:30:00.000Z")],
    // valid date string with time
    ["2023-04-25 10:30", new Date("2023-04-25T10:30:00.000Z")],
    // valid date string with timezone
    ["2023-04-25T10:30:00.000+02:00", new Date("2023-04-25T08:30:00.000Z")],
    // valid time string
    ["10:30", new Date(getTodayIsoDate() + "T10:30:00.000Z")],
    // valid time string with milliseconds
    ["10:30:25.123", new Date(getTodayIsoDate() + "T10:30:25.123Z")],
    // valid time string with seconds
    ["10:30:25", new Date(getTodayIsoDate() + "T10:30:25.000Z")],
    // valid month string
    ["Jan 2023", new Date("2023-01-01T00:00:00.000Z")],
    // valid month string with day
    ["Jan 15, 2023", new Date("2023-01-15T00:00:00.000Z")],
    // valid date string with day and month names
    ["25 April 2023", new Date("2023-04-25T00:00:00.000Z")],
    // valid date string with day and short month names
    ["25 Apr 2023", new Date("2023-04-25T00:00:00.000Z")],
    // valid date string with short day and month names
    ["Tue, 25 Apr 2023", new Date("2023-04-25T00:00:00.000Z")],
    // valid date string with time and AM/PM
    ["2023-04-25 10:30 AM", new Date("2023-04-25T10:30:00.000Z")],
    // valid Unix timestamp in seconds as a string
    ["1671951600", new Date("2022-12-25T07:00:00.000Z")],
  ])("converts input %p to the correct date %p", (input, expectedOutput) => {
    expect(toSafeDate(input)).toEqual(expectedOutput)
  })
})
