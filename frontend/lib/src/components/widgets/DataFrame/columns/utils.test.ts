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
import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"
import { Field, makeVector, Utf8 } from "apache-arrow"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import {
  arrayToCopyValue,
  BaseColumnProps,
  countDecimals,
  getEmptyCell,
  getErrorCell,
  getLinkDisplayValueFromRegex,
  getTextCell,
  hasTooltip,
  isEditableArrayValue,
  isErrorCell,
  isMaybeJson,
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

describe("isEditableArrayValue", () => {
  it.each([
    // strings
    ["foo", true],
    [new String("bar"), true],
    // arrays
    [["a", "b"], true],
    [[new String("a"), new String("b")], true],
    [[], true],
    [["a", 1], false],
    [[1, 2, 3], false],
    // numbers/booleans/objects
    [123, false],
    [true, false],
    [false, false],
    [{ foo: "bar" }, false],
    [null, false],
    [undefined, false],
    // Apache Arrow vectors
    [makeVector(Int32Array.from([1, 2, 3])), false],
  ])("interprets %s as editable array value: %s", (input, expected) => {
    expect(isEditableArrayValue(input)).toBe(expected)
  })
})

describe("arrayToCopyValue", () => {
  it.each([
    [null, ""],
    [undefined, ""],
    [[], ""],
    [["a"], "a"],
    [["a", "b"], "a,b"],
    // commas inside values are replaced by spaces before joining
    [["a,b"], "a b"],
    [["a,b", "c,d"], "a b,c d"],
    [[1, "a,b"], "1,a b"],
    [["hello,world", 42, true], "hello world,42,true"],
    [[{ foo: "bar" }], "[object Object]"],
  ])("converts %s to copy string '%s'", (input, expected) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(arrayToCopyValue(input as any)).toBe(expected)
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

it("removeLineBreaks should remove line breaks", () => {
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

describe("hasTooltip", () => {
  it("returns true for cells with non-empty tooltip", () => {
    const cellWithTooltip = {
      kind: GridCellKind.Text,
      data: "test",
      allowOverlay: true,
      tooltip: "This is a tooltip",
    }
    expect(hasTooltip(cellWithTooltip)).toBe(true)
  })

  it("returns false for cells with empty tooltip", () => {
    const cellWithEmptyTooltip = {
      kind: GridCellKind.Text,
      data: "test",
      allowOverlay: true,
      tooltip: "",
    }
    expect(hasTooltip(cellWithEmptyTooltip)).toBe(false)
  })

  it("returns false for cells without tooltip property", () => {
    const cellWithoutTooltip = {
      kind: GridCellKind.Text,
      data: "test",
      allowOverlay: true,
    }
    expect(hasTooltip(cellWithoutTooltip)).toBe(false)
  })
})

describe("isMaybeJson", () => {
  it.each([
    ['{"key": "value"}', true],
    ["{}", true],
    ['{"nested": {"a": 1}}', true],
    ["{invalid json}", true], // Still looks like JSON (starts with { ends with })
  ])(
    "returns true for string starting with { and ending with }: %p",
    (input, expected) => {
      expect(isMaybeJson(input)).toBe(expected)
    }
  )

  it.each([
    ["plain text", false],
    ["[1, 2, 3]", false], // Arrays don't start with {
    ["", false],
    ["{ missing end", false],
    ["missing start }", false],
    [" {padded} ", false], // Has spaces around
  ])(
    "returns false for string not starting with { or not ending with }: %p",
    input => {
      expect(isMaybeJson(input)).toBeFalsy()
    }
  )

  it("returns undefined for null and undefined values", () => {
    expect(isMaybeJson(null)).toBeUndefined()
    expect(isMaybeJson(undefined)).toBeUndefined()
  })
})

describe("getTextCell with different parameters", () => {
  it("creates a non-faded text cell", () => {
    const textCell = getTextCell(false, false)
    expect(textCell.style).toBe("normal")
    expect(textCell.readonly).toBe(false)
  })

  it("creates a faded text cell", () => {
    const textCell = getTextCell(true, true)
    expect(textCell.style).toBe("faded")
    expect(textCell.readonly).toBe(true)
  })
})

describe("mergeColumnParameters edge cases", () => {
  it("returns empty object when both params are null", () => {
    const merged = mergeColumnParameters(null, null)
    expect(merged).toEqual({})
  })

  it("returns userParams when defaultParams is undefined", () => {
    const userParams = { foo: "bar" }
    const merged = mergeColumnParameters(undefined, userParams)
    expect(merged).toEqual(userParams)
  })

  it("returns defaultParams when userParams is undefined", () => {
    const defaultParams = { foo: "bar" }
    const merged = mergeColumnParameters(defaultParams, undefined)
    expect(merged).toEqual(defaultParams)
  })

  it("deeply merges nested objects", () => {
    const defaultParams = {
      nested: { a: 1, b: 2 },
      top: "value",
    }
    const userParams = {
      nested: { b: 3, c: 4 },
    }
    const merged = mergeColumnParameters(defaultParams, userParams)
    expect(merged).toEqual({
      nested: { a: 1, b: 3, c: 4 },
      top: "value",
    })
  })
})
