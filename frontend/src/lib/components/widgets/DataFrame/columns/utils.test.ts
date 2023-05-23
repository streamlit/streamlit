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
import moment, { Moment } from "moment"
import timezoneMock from "timezone-mock"

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
  countDecimals,
  truncateDecimals,
  formatMoment,
  removeLineBreaks,
} from "./utils"
import { TextColumn } from "./index"

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
    expect(isMissingValueCell(emptyCell)).toEqual(false)
  })

  it("creates a valid empty cell with missing placeholder", () => {
    const emptyCell = getEmptyCell(true)
    expect(emptyCell.kind).toEqual(GridCellKind.Loading)
    expect(emptyCell.allowOverlay).toEqual(false)
    expect(isMissingValueCell(emptyCell)).toEqual(true)
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
    [10, "10"],
    [10.1, "10.1"],
    [10.123, "10.123"],
    [10.1234, "10.1234"],
    // Rounds to 4 decimals
    [10.12346, "10.1235"],
  ])(
    "formats %p to %p with default options (no trailing zeros)",
    (value, expected) => {
      expect(formatNumber(value)).toEqual(expected)
    }
  )

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
      expect(formatNumber(value, undefined, decimals)).toEqual(expected)
    }
  )

  it.each([
    [0.5, "percent", "50.00%"],
    [0.51236, "percent", "51.24%"],
    [1.1, "percent", "110.00%"],
    [0, "percent", "0.00%"],
    [0.00001, "percent", "0.00%"],
    [1000, "compact", "1K"],
    [1100, "compact", "1.1K"],
    [10, "compact", "10"],
    [10.123, "compact", "10"],
    [123456789, "compact", "123M"],
    [1000, "scientific", "1E3"],
    [123456789, "scientific", "1.235E8"],
    [1000, "engineering", "1E3"],
    [123456789, "engineering", "123.457E6"],
    // sprintf format
    [10.123, "%d", "10"],
    [10.123, "%i", "10"],
    [10.123, "%u", "10"],
    [10.123, "%f", "10.123"],
    [10.123, "%g", "10.123"],
    [10, "$%.2f", "$10.00"],
    [10.126, "$%.2f", "$10.13"],
    [10.123, "%.2f€", "10.12€"],
    [10.126, "($%.2f)", "($10.13)"],
    [65, "%d years", "65 years"],
    [1234567898765432, "%d ⭐", "1234567898765432 ⭐"],
    [72.3, "%.1f%%", "72.3%"],
    [-5.678, "%.1f", "-5.7"],
    [0.123456, "%.4f", "0.1235"],
    [0.123456, "%.4g", "0.1235"],
    // Test boolean formatting:
    [1, "%t", "true"],
    [0, "%t", "false"],
    // Test zero-padding for integers
    [42, "%05d", "00042"],
    // Test scientific notations:
    [1234.5678, "%.2e", "1.23e+3"],
    [0.000123456, "%.2e", "1.23e-4"],
    // Test hexadecimal representation:
    [255, "%x", "ff"],
    [255, "%X", "FF"],
    [4096, "%X", "1000"],
    // Test octal representation:
    [8, "%o", "10"],
    [64, "%o", "100"],
    // Test fixed width formatting:
    [12345, "%8d", "   12345"],
    [12.34, "%8.2f", "   12.34"],
    [12345, "%'_8d", "___12345"],
    // Test left-justified formatting:
    [12345, "%-8d", "12345   "],
    [12.34, "%-8.2f", "12.34   "],
    // Test prefixing with plus sign:
    [42, "%+d", "+42"],
    [-42, "%+d", "-42"],
  ])("formats %p with format %p to '%p'", (value, format, expected) => {
    expect(formatNumber(value, format)).toEqual(expected)
  })

  it.each([
    [10, "%d %d"],
    [1234567.89, "%'_,.2f"],
    [1234.5678, "%+.2E"],
    [0.000123456, "%+.2E"],
    [-0.000123456, "%+.2E"],
    [255, "%#x"],
    [4096, "%#X"],
    [42, "% d"],
    [1000, "%,.0f"],
    [25000.25, "$%,.2f"],
    [9876543210, "%,.0f"],
  ])(
    "cannot format %p using the invalid sprintf format %p",
    (input: number, format: string) => {
      expect(() => {
        formatNumber(input, format)
      }).toThrowError()
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
    // valid unix timestamp in milliseconds
    [1671951600000, new Date("2022-12-25T07:00:00.000Z")],
    // valid unix timestamp in microseconds
    [1671951600000000, new Date("2022-12-25T07:00:00.000Z")],
    // valid unix timestamp in nanoseconds
    [1671951600000000000, new Date("2022-12-25T07:00:00.000Z")],
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

describe("countDecimals", () => {
  it.each([
    [0, 0],
    [1, 0],
    [0.1, 1],
    [0.01, 2],
    [0.123456789, 9],
    [0.000001, 6],
    [0.0000001, 7],
    [1.23456789e-10, 18],
    [0.0000000000000000001, 19],
    [-0.12345, 5],
    [123456789432, 0],
    // eslint-disable-next-line  @typescript-eslint/no-loss-of-precision
    [123456789876543212312313, 0],
    // It is expected that very large and small numbers won't work correctly:
    // eslint-disable-next-line  @typescript-eslint/no-loss-of-precision
    [1234567898765432.1, 0],
    [0.0000000000000000000001, 0],
    [1.234567890123456e-20, 20],
  ])("should return correct decimal count for %d", (value, expected) => {
    const result = countDecimals(value)
    expect(result).toEqual(expected)
  })
})

describe("truncateDecimals", () => {
  it.each([
    [3.14159265, 2, 3.14],
    [123.456, 1, 123.4],
    [-3.14159265, 2, -3.14],
    [-123.456, 1, -123.4],
    [3.14159265, 0, 3],
    [123.456, 0, 123],
    [-3.14159265, 0, -3],
    [-123.456, 0, -123],
    [42, 0, 42],
    [-42, 0, -42],
    [0.1 + 0.2, 2, 0.3],
  ])(
    "truncates value %f to %i decimal places, resulting in %f",
    (value, decimals, expected) => {
      expect(truncateDecimals(value, decimals)).toBe(expected)
    }
  )
})

describe("formatMoment", () => {
  beforeAll(() => {
    jest.useFakeTimers("modern")
    jest.setSystemTime(new Date("2022-04-28T00:00:00Z"))
    timezoneMock.register("UTC")
  })

  afterAll(() => {
    jest.useRealTimers()
    timezoneMock.unregister()
  })

  it.each([
    [
      "YYYY-MM-DD HH:mm:ss z",
      moment.utc("2023-04-27T10:20:30Z"),
      "2023-04-27 10:20:30 UTC",
    ],
    [
      "YYYY-MM-DD HH:mm:ss z",
      moment.utc("2023-04-27T10:20:30Z").tz("America/Los_Angeles"),
      "2023-04-27 03:20:30 PDT",
    ],
    [
      "YYYY-MM-DD HH:mm:ss Z",
      moment.utc("2023-04-27T10:20:30Z").tz("America/Los_Angeles"),
      "2023-04-27 03:20:30 -07:00",
    ],
    [
      "YYYY-MM-DD HH:mm:ss Z",
      moment.utc("2023-04-27T10:20:30Z").utcOffset("+04:00"),
      "2023-04-27 14:20:30 +04:00",
    ],
    ["YYYY-MM-DD", moment.utc("2023-04-27T10:20:30Z"), "2023-04-27"],
    [
      "MMM Do, YYYY [at] h:mm A",
      moment.utc("2023-04-27T15:45:00Z"),
      "Apr 27th, 2023 at 3:45 PM",
    ],
    [
      "MMMM Do, YYYY Z",
      moment.utc("2023-04-27T10:20:30Z").utcOffset("-02:30"),
      "April 27th, 2023 -02:30",
    ],
    // Distance:
    ["distance", moment.utc("2022-04-10T20:20:30Z"), "17 days ago"],
    ["distance", moment.utc("2020-04-10T20:20:30Z"), "2 years ago"],
    ["distance", moment.utc("2022-04-27T23:59:59Z"), "a few seconds ago"],
    ["distance", moment.utc("2022-04-20T00:00:00Z"), "8 days ago"],
    ["distance", moment.utc("2022-05-27T23:59:59Z"), "in a month"],
    ["relative", moment.utc("2022-04-30T15:30:00Z"), "Saturday at 3:30 PM"],
    // Relative:
    [
      "relative",
      moment.utc("2022-04-24T12:20:30Z"),
      "Last Sunday at 12:20 PM",
    ],
    ["relative", moment.utc("2022-04-28T12:00:00Z"), "Today at 12:00 PM"],
    ["relative", moment.utc("2022-04-29T12:00:00Z"), "Tomorrow at 12:00 PM"],
  ])(
    "uses %s format to format %p to %p",
    (format: string, momentDate: Moment, expected: string) => {
      expect(formatMoment(momentDate, format)).toBe(expected)
    }
  )
})

test("removeLineBreaks should remove line breaks", () => {
  expect(removeLineBreaks("\n")).toBe(" ")
  expect(removeLineBreaks("\nhello\n\nworld")).toBe(" hello  world")
})
