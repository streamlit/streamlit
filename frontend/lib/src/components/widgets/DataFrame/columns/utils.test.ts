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
import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"
import { Field, Utf8 } from "apache-arrow"
import moment, { Moment } from "moment-timezone"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { withTimezones } from "~lib/util/withTimezones"

import {
  BaseColumnProps,
  countDecimals,
  formatMoment,
  formatNumber,
  getEmptyCell,
  getErrorCell,
  getLinkDisplayValueFromRegex,
  getTextCell,
  isErrorCell,
  isMissingValueCell,
  mergeColumnParameters,
  removeLineBreaks,
  toGlideColumn,
  toJsonString,
  toSafeArray,
  toSafeBoolean,
  toSafeDate,
  toSafeNumber,
  toSafeString,
  truncateDecimals,
} from "./utils"

import { TextColumn } from "./index"

const MOCK_TEXT_COLUMN_PROPS = {
  id: "column_1",
  name: "column_1",
  title: "column_1",
  indexNumber: 0,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field("test", new Utf8(), true),
    pandasType: {
      field_name: "test",
      name: "test",
      pandas_type: "unicode",
      numpy_type: "object",
      metadata: null,
    },
  },
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
} as BaseColumnProps

describe("getErrorCell", () => {
  it("creates a valid error cell", () => {
    const errorCell = getErrorCell("Foo Error", "Lorem Ipsum Dolor")
    expect(errorCell.kind).toEqual(GridCellKind.Text)
    expect(errorCell.readonly).toEqual(true)
    expect(errorCell.allowOverlay).toEqual(true)
    expect(errorCell.displayData).toEqual("Foo Error")
    expect(errorCell.data).toEqual("Foo Error")
    expect(errorCell.errorDetails).toEqual("Lorem Ipsum Dolor")
    expect(errorCell.isError).toEqual(true)
    expect(errorCell.style).toEqual("faded")
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
  ])("converts %s to a valid array: %s", (input, expected) => {
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
  ])("converts %s to a valid string: %s", (input, expected) => {
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
  ])("converts %s to a boolean: %s", (input, expected) => {
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
  ])("converts %s to a valid number: %s", (input, expected) => {
    expect(toSafeNumber(input)).toEqual(expected)
  })
})

describe("formatNumber", () => {
  it("enforces localized currency format as narrow", () => {
    const originalLanguages = navigator.languages
    // Change locale for this test:
    Object.defineProperty(navigator, "languages", {
      value: ["pt-BR"],
      configurable: true,
    })

    expect(formatNumber(10.123, "euro")).toEqual("€ 10,12")
    expect(formatNumber(10.123, "dollar")).toEqual("$ 10,12")
    expect(formatNumber(10.123, "yen")).toEqual("¥ 10") // would be JP¥ 10 if narrow symbol is not used

    // Restore original navigator languages
    Object.defineProperty(navigator, "languages", {
      value: originalLanguages,
      configurable: true,
    })
  })

  it.each([
    [10, "10"],
    [10.1, "10.1"],
    [10.123, "10.123"],
    [10.1234, "10.1234"],
    // Rounds to 4 decimals
    [10.12346, "10.1235"],
    [0.00016, "0.0002"],
    // If number is smaller than 0.0001, shows the next decimal number
    // to avoid showing 0 for small numbers.
    [0.000051, "0.00005"],
    [0.00000123, "0.000001"],
    [0.00000183, "0.000002"],
    [0.0000000061, "0.000000006"],
  ])(
    "formats %s to %s with default options (no trailing zeros)",
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
    "formats %s to %s with %s decimals (keeps trailing zeros)",
    (value, decimals, expected) => {
      expect(formatNumber(value, undefined, decimals)).toEqual(expected)
    }
  )

  it.each([
    [0.5, "percent", "50%"],
    [0.51236, "percent", "51.24%"],
    [-1.123456, "percent", "-112.35%"],
    [0, "percent", "0%"],
    [0.00001, "percent", "0%"],
    [1000, "compact", "1K"],
    [1100, "compact", "1.1K"],
    [10, "compact", "10"],
    [10.123, "compact", "10"],
    [123456789, "compact", "123M"],
    [1000, "scientific", "1E3"],
    [123456789, "scientific", "1.235E8"],
    [1000, "engineering", "1E3"],
    [123456789, "engineering", "123.457E6"],
    [1234.567, "engineering", "1.235E3"],
    // plain
    [10.1231234, "plain", "10.1231234"],
    [-1234.456789, "plain", "-1234.456789"],
    [0.00000001, "plain", "0.00000001"],
    // dollar
    [10, "dollar", "$10.00"],
    [10.123, "dollar", "$10.12"],
    [-1234.456789, "dollar", "-$1,234.46"],
    [0.00000001, "dollar", "$0.00"],
    // euro
    [10, "euro", "€10.00"],
    [10.123, "euro", "€10.12"],
    [-1234.456789, "euro", "-€1,234.46"],
    [0.00000001, "euro", "€0.00"],
    // yen
    [10.123, "yen", "¥10"],
    [-1234.456789, "yen", "-¥1,234"],
    [0.00000001, "yen", "¥0"],
    // localized
    [10.123, "localized", "10.123"],
    [-1234.456789, "localized", "-1,234.457"],
    [0.001, "localized", "0.001"],
    // accounting
    [10.123, "accounting", "10.12"],
    [-10.126, "accounting", "(10.13)"],
    [-10.1, "accounting", "(10.10)"],
    [1000000.123412, "accounting", "1,000,000.12"],
    [-1000000.123412, "accounting", "(1,000,000.12)"],
    // bytes
    [0, "bytes", "0B"],
    [12, "bytes", "12B"],
    [123, "bytes", "123B"],
    [12345, "bytes", "12.3KB"],
    [123456789, "bytes", "123.5MB"],
    [1234567890, "bytes", "1.2GB"],
    [1234567890000, "bytes", "1.2TB"],
    [1234567890000000, "bytes", "1234.6TB"],
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
  ])("formats %s with format %s to '%s'", (value, format, expected) => {
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
    "cannot format %s using the invalid sprintf format %s",
    (input: number, format: string) => {
      expect(() => {
        formatNumber(input, format)
      }).toThrow()
    }
  )

  it.each([
    // No format (default)
    [10.123, undefined, 2, "10.12"],
    [10.123, undefined, 5, "10.12300"],
    // localized
    [10.12345, "localized", undefined, "10.123"],
    [10.12345, "localized", 2, "10.12"],
    [10, "localized", 3, "10.000"],
    // percent - the max precision is applied to the raw value:
    [0.12345, "percent", undefined, "12.35%"],
    [0.12345, "percent", 3, "12.3%"],
    [0.12345, "percent", 4, "12.35%"],
    [0.123, "percent", 5, "12.300%"],
    [0.123, "percent", 0, "12%"],
    // dollar
    [10.129, "dollar", undefined, "$10.13"],
    [10.129, "dollar", 2, "$10.13"],
    [10.129, "dollar", 0, "$10"],
    [10, "dollar", 3, "$10.000"],
    // euro
    [10.129, "euro", undefined, "€10.13"],
    [10.129, "euro", 2, "€10.13"],
    [10.129, "euro", 0, "€10"],
    [10, "euro", 3, "€10.000"],
    // yen
    [10.129, "yen", undefined, "¥10"],
    [10.129, "yen", 0, "¥10"],
    [10.129, "yen", 2, "¥10.13"],
    // bytes - doesn't impact bytes:
    [10.129, "bytes", undefined, "10.1B"],
    [10.129, "bytes", 2, "10.1B"],
    [10.129, "bytes", 0, "10.1B"],
    // accounting
    [-10.129, "accounting", undefined, "(10.13)"],
    [-10.129, "accounting", 2, "(10.13)"],
    [-10.129, "accounting", 1, "(10.1)"],
    [1000, "accounting", 0, "1,000"],
    [-10, "accounting", 3, "(10.000)"],
  ])(
    "formats %s with format %s and maxPrecision %d to '%s'",
    (value, format, maxPrecision, expected) => {
      expect(formatNumber(value, format, maxPrecision)).toEqual(expected)
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
      menuIcon: "dots",
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

    expect(toGlideColumn(textColumn).grow).toEqual(1)

    // Pinned columns should not use grow:
    const indexColumn = TextColumn({
      ...MOCK_TEXT_COLUMN_PROPS,
      isStretched: true,
      isPinned: true,
    })

    expect(toGlideColumn(indexColumn).grow).toEqual(undefined)
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
  ])("converts input %s to the correct date %s", (input, expectedOutput) => {
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
    // eslint-disable-next-line no-loss-of-precision
    [123456789876543212312313, 0],
    // It is expected that very large and small numbers won't work correctly:
    // eslint-disable-next-line no-loss-of-precision
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
    [4.52, 2, 4.52],
    [0.0099999, 2, 0.0],
  ])(
    "truncates value %f to %i decimal places, resulting in %f",
    (value, decimals, expected) => {
      expect(truncateDecimals(value, decimals)).toBe(expected)
    }
  )
})

withTimezones(() => {
  describe("formatMoment", () => {
    beforeAll(() => {
      const d = new Date("2022-04-28T00:00:00Z")
      vi.useFakeTimers()
      vi.setSystemTime(d)
    })

    afterAll(() => {
      vi.useRealTimers()
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
      // Calendar:
      ["calendar", moment.utc("2022-04-30T15:30:00Z"), "Saturday at 3:30 PM"],
      [
        "calendar",
        moment.utc("2022-04-24T12:20:30Z"),
        "Last Sunday at 12:20 PM",
      ],
      ["calendar", moment.utc("2022-04-28T12:00:00Z"), "Today at 12:00 PM"],
      ["calendar", moment.utc("2022-04-29T12:00:00Z"), "Tomorrow at 12:00 PM"],
      // ISO8601:
      [
        "iso8601",
        moment.utc("2023-04-27T10:20:30.123Z"),
        "2023-04-27T10:20:30.123Z",
      ],
    ])(
      "uses %s format to format %s to %s",
      (format: string, momentDate: Moment, expected: string) => {
        expect(formatMoment(momentDate, format)).toBe(expected)
      }
    )
  })
})

test("removeLineBreaks should remove line breaks", () => {
  expect(removeLineBreaks("\n")).toBe(" ")
  expect(removeLineBreaks("\nhello\n\nworld")).toBe(" hello  world")
})

describe("getLinkDisplayValueFromRegex", () => {
  it.each([
    [
      new RegExp("https://(.*?).streamlit.app"),
      "https://example.streamlit.app",
      "example",
    ],
    [
      new RegExp("https://(.*?).streamlit.app"),
      "https://my-cool-app.streamlit.app",
      "my-cool-app",
    ],
    [
      new RegExp("https://(.*?).streamlit.app"),
      "https://example.streamlit.app?param=value",
      "example",
    ],
    [
      new RegExp("https://(.*?).streamlit.app"),
      "https://example.streamlit.app?param1=value1&param2=value2",
      "example",
    ],
    [new RegExp("id=(.*?)&"), "https://example.com?id=123&type=user", "123"],
    [
      new RegExp("[?&]user=(.*?)(?:&|$)"),
      "https://example.com?page=1&user=john_doe&sort=desc",
      "john_doe",
    ],
    [
      new RegExp("https://(.*?).streamlit.app"),
      "https://my%20cool%20app.streamlit.app",
      "my cool app",
    ],
    [
      new RegExp("https://(.*?).streamlit.app"),
      "https://special%21chars%40app.streamlit.app",
      "special!chars@app",
    ],
    [
      new RegExp("user=(.*?)(?:&|$)"),
      "https://example.com?user=john%20doe%40email.com",
      "john doe@email.com",
    ],
    [
      new RegExp("name=(.*?)&"),
      "https://example.com?name=%E2%9C%A8special%20user%E2%9C%A8&type=vip",
      "✨special user✨",
    ],
    [
      new RegExp("q=(.*?)&"),
      "https://example.com?q=%D0%BF%D1%80%D0%B8%D0%B2%D0%B5%D1%82&lang=ru",
      "привет",
    ],
    [
      new RegExp("path/(.*?)/"),
      "https://example.com/path/user%20name%20%26%20company/settings",
      "user name & company",
    ],
    [
      new RegExp("search/(.*?)\\?"),
      "https://example.com/search/space%20%26%20time?page=1",
      "space & time",
    ],
    [
      new RegExp("https://(.*?).other.app"),
      "https://example.streamlit.app",
      "https://example.streamlit.app",
    ],
    [new RegExp("https://(.*?).streamlit.app"), null, ""],
    [new RegExp("https://(.*?).streamlit.app"), undefined, ""],
    [
      new RegExp(".*meal=(.*)"),
      "https://example.com/feedme?meal=fish+%26+chips%3A+%C2%A39",
      "fish & chips: £9",
    ],
  ])(
    "extracts display value from %s with href %s to be %s",
    (regex: RegExp, href: string | null | undefined, expected: string) => {
      expect(getLinkDisplayValueFromRegex(regex, href)).toBe(expected)
    }
  )
})

describe("toJsonString", () => {
  it.each([
    // Simple values
    ["hello", "hello"],
    [123, "123"],
    [true, "true"],
    [false, "false"],
    [null, ""],
    [undefined, ""],
    // Arrays
    [[1, 2, 3], "[1,2,3]"],
    [["a", "b", "c"], '["a","b","c"]'],
    [[1, "a", true], '[1,"a",true]'],
    // Objects
    [{ a: 1, b: 2 }, '{"a":1,"b":2}'],
    [{ name: "test", active: true }, '{"name":"test","active":true}'],
    // Nested structures
    [{ arr: [1, 2, { x: "y" }] }, '{"arr":[1,2,{"x":"y"}]}'],
    // BigInt handling
    [BigInt(123), "123"],
    [{ big: BigInt(9007199254740991) }, '{"big":9007199254740991}'],
    // Already stringified JSON
    ['{"test":123}', '{"test":123}'],
    // Circular reference (should use toSafeString fallback)
    [
      (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
        const circular: any = { a: 1 }
        circular.self = circular
        return circular
      })(),
      "[object Object]",
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  ])("converts %o to JSON string %s", (input: any, expected: string) => {
    expect(toJsonString(input)).toBe(expected)
  })
})
