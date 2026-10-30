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

import {
  Binary,
  Bool,
  DateDay,
  Decimal,
  DecimalBuilder,
  Duration,
  Field,
  Float64,
  Int64,
  List,
  Struct,
  Time,
  Timestamp,
  TimeUnit,
  Uint64,
  Utf8,
  vectorFromArray,
} from "apache-arrow"
import { getLogger } from "loglevel"
import { vi } from "vitest"

import { Quiver } from "~lib/dataframes/Quiver"
import { DECIMAL } from "~lib/mocks/arrow/types/decimal"
import { DICTIONARY } from "~lib/mocks/arrow/types/dictionary"
import { INT64 } from "~lib/mocks/arrow/types/int64"
import { INTERVAL_CATEGORICAL } from "~lib/mocks/arrow/types/intervalCategorical"
import { INTERVAL_DATETIME64 } from "~lib/mocks/arrow/types/intervalDatetime64"
import { INTERVAL_FLOAT64 } from "~lib/mocks/arrow/types/intervalFloat64"
import { INTERVAL_INT64 } from "~lib/mocks/arrow/types/intervalInt64"
import { INTERVAL_UINT64 } from "~lib/mocks/arrow/types/intervalUint64"
import { PERIOD } from "~lib/mocks/arrow/types/period"
import { PERIOD_EXTENSION } from "~lib/mocks/arrow/types/periodExtension"
import { TIMEDELTA } from "~lib/mocks/arrow/types/timedelta"
import { UINT64 } from "~lib/mocks/arrow/types/uint64"

import {
  convertDurationToMilliseconds,
  convertTimestampToSeconds,
  convertTimeToDate,
  format,
  formatDurationFromSeconds,
  formatPeriodFromFreq,
  getDurationFractionalSecondDigits,
  isValidDurationSeconds,
} from "./arrowFormatUtils"
import { DataFrameCellType } from "./arrowTypeUtils"

const PERIOD_DAY_PANDAS_TYPE = {
  field_name: "p",
  name: "p",
  pandas_type: "object",
  numpy_type: "period[D]",
  metadata: null,
}

describe("format", () => {
  it("null", () => {
    expect(
      format(null, {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Utf8(), true),
        pandasType: undefined,
      })
    ).toEqual("")
  })

  it("string", () => {
    expect(
      format("foo", {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Utf8(), true),
        pandasType: undefined,
      })
    ).toEqual("foo")
  })

  it("boolean", () => {
    expect(
      format(true, {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Bool(), true),
        pandasType: undefined,
      })
    ).toEqual("true")
  })

  it("float64", () => {
    expect(
      format(1.25, {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Float64(), true),
        pandasType: undefined,
      })
    ).toEqual("1.2500")
  })

  it("int64", () => {
    const mockElement = { data: INT64 }
    const q = new Quiver(mockElement)
    const { content } = q.getCell(0, 2)

    expect(
      format(content, {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Int64(), true),
        pandasType: undefined,
      })
    ).toEqual("1")
  })

  it("uint64", () => {
    const mockElement = { data: UINT64 }
    const q = new Quiver(mockElement)
    const { content } = q.getCell(0, 2)

    expect(
      format(content, {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Uint64(), true),
        pandasType: undefined,
      })
    ).toEqual("2")
  })

  it("bytes", () => {
    expect(
      format(new Uint8Array([1, 2, 3]), {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Binary(), true),
        pandasType: undefined,
      })
    ).toEqual("1,2,3")
  })

  it("date", () => {
    expect(
      format(new Date(Date.UTC(1970, 0, 1)), {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new DateDay(), true),
        pandasType: undefined,
      })
    ).toEqual("1970-01-01")
  })

  it("datetime", () => {
    expect(
      format(0, {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Timestamp(TimeUnit.SECOND), true),
        pandasType: undefined,
      })
    ).toEqual("1970-01-01 00:00:00")
  })

  it("datetimetz", () => {
    expect(
      format(0, {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new Timestamp(TimeUnit.SECOND, "Europe/Moscow"),
          true
        ),
        pandasType: undefined,
      })
    ).toEqual("1970-01-01 03:00:00+03:00")
  })

  it("datetimetz with offset", () => {
    expect(
      format(0, {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new Timestamp(TimeUnit.SECOND, "+01:00"),
          true
        ),
        pandasType: undefined,
      })
    ).toEqual("1970-01-01 01:00:00+01:00")
  })

  it("interval datetime64[ns]", () => {
    const mockElement = { data: INTERVAL_DATETIME64 }
    const q = new Quiver(mockElement)
    const { content, contentType } = q.getCell(0, 0)

    expect(format(content, contentType)).toEqual(
      "(2017-01-01 00:00:00, 2017-01-02 00:00:00]"
    )
  })

  it("interval float64", () => {
    const mockElement = { data: INTERVAL_FLOAT64 }
    const q = new Quiver(mockElement)
    const { content, contentType } = q.getCell(0, 0)

    expect(format(content, contentType)).toEqual("(0.0000, 1.5000]")
  })

  it("interval int64", () => {
    const mockElement = { data: INTERVAL_INT64 }
    const q = new Quiver(mockElement)
    const { content, contentType } = q.getCell(0, 0)

    expect(format(content, contentType)).toEqual("(0, 1]")
  })

  it("interval uint64", () => {
    const mockElement = { data: INTERVAL_UINT64 }
    const q = new Quiver(mockElement)
    const { content, contentType } = q.getCell(0, 0)

    expect(format(content, contentType)).toEqual("(0, 1]")
  })

  it("decimal", () => {
    const mockElement = { data: DECIMAL }
    const q = new Quiver(mockElement)
    const cell1 = q.getCell(0, 1)
    expect(format(cell1.content, cell1.contentType)).toEqual("1.1")

    const cell2 = q.getCell(1, 1)
    expect(format(cell2.content, cell2.contentType)).toEqual("10000")

    const cell3 = q.getCell(0, 2)
    expect(format(cell3.content, cell3.contentType)).toEqual("2.23")

    const cell4 = q.getCell(1, 2)
    expect(format(cell4.content, cell4.contentType)).toEqual("-0.1")
  })

  it.each([
    {
      bitWidth: 256,
      unscaled: "-3864734299516908213",
      scale: 20,
      expected: "-0.03864734299516908213",
    },
    {
      bitWidth: 256,
      unscaled: "111111111111111111111100000000000000000000",
      scale: 20,
      expected: "1111111111111111111111",
    },
    {
      bitWidth: 256,
      unscaled: "150000000000000000000",
      scale: 20,
      expected: "1.5",
    },
    {
      bitWidth: 256,
      unscaled: "-111111111111111111111150000000000000000000",
      scale: 20,
      expected: "-1111111111111111111111.5",
    },
    {
      bitWidth: 128,
      unscaled: "-12345678901234567890123456789",
      scale: 2,
      expected: "-123456789012345678901234567.89",
    },
  ])(
    "decimal$bitWidth $unscaled with scale $scale formats as $expected",
    ({ bitWidth, unscaled, scale, expected }) => {
      const precision = bitWidth === 256 ? 76 : 38
      const decimalType = new Decimal(scale, precision, bitWidth)
      const wordCount = bitWidth / 32
      // Little-endian two's complement 32-bit words.
      let rest = BigInt.asUintN(bitWidth, BigInt(unscaled))
      const words = new Uint32Array(wordCount)
      for (let i = 0; i < wordCount; i++) {
        words[i] = Number(rest & BigInt(0xffffffff))
        rest >>= BigInt(32)
      }
      const builder = new DecimalBuilder({
        type: decimalType,
        nullValues: null,
      })
      builder.append(words)
      const value = builder.finish().toVector().get(0)
      const arrowType = {
        type: DataFrameCellType.DATA,
        arrowField: new Field("c", decimalType, true),
        pandasType: undefined,
      }

      expect(value?.length).toEqual(wordCount)
      expect(format(value, arrowType)).toEqual(expected)
    }
  )

  it("timedelta", () => {
    const mockElement = { data: TIMEDELTA }
    const q = new Quiver(mockElement)
    const cell1 = q.getCell(0, 1)
    expect(format(cell1.content, cell1.contentType)).toEqual("a few seconds")

    const cell2 = q.getCell(1, 1)
    expect(format(cell2.content, cell2.contentType)).toEqual("4 hours")

    const cell3 = q.getCell(0, 2)
    expect(format(cell3.content, cell3.contentType)).toEqual("20 days")

    const cell4 = q.getCell(1, 2)
    expect(format(cell4.content, cell4.contentType)).toEqual("2 hours")
  })

  it("dictionary", () => {
    const mockElement = { data: DICTIONARY }
    const q = new Quiver(mockElement)
    const { content, contentType } = q.getCell(0, 1)
    expect(format(content, contentType)).toEqual(`{"a":1,"b":2}`)
  })

  it("period", () => {
    const mockElement = { data: PERIOD }
    const q = new Quiver(mockElement)
    const { numDataRows, numColumns } = q.dimensions
    const table: Record<string, string[]> = {}

    // Get column names
    const headers = q.columnNames[0]

    // Start from index 1 to skip the index column
    for (let columnIndex = 1; columnIndex < numColumns; columnIndex++) {
      const values = []
      // Iterate through data rows
      for (let rowIndex = 0; rowIndex < numDataRows; rowIndex++) {
        const { content, contentType } = q.getCell(rowIndex, columnIndex)
        const cellValue = format(content, contentType)
        values.push(cellValue)
      }
      // add it via the header name key:
      table[headers[columnIndex]] = values
    }

    expect(table).toEqual({
      A: ["2012", "1970"],
      M: ["2012-02", "1970-01"],
      Y: ["2012", "1970"],
      h: ["2012-02-14 00:00", "1970-01-01 00:00"],
      min: ["2012-02-14 00:00", "1970-01-01 00:00"],
      ms: ["2012-02-14 00:00:00.000", "1970-01-01 00:00:00.000"],
      s: ["2012-02-14 00:00:00", "1970-01-01 00:00:00"],
      L: ["2012-02-14 00:00:00.000", "1970-01-01 00:00:00.000"],
      S: ["2012-02-14 00:00:00", "1970-01-01 00:00:00"],
      T: ["2012-02-14 00:00", "1970-01-01 00:00"],
      H: ["2012-02-14 00:00", "1970-01-01 00:00"],
      D: ["2012-02-14", "1970-01-01"],
      W: ["2012-02-13/2012-02-19", "1969-12-29/1970-01-04"],
      "W-SUN": ["2012-02-13/2012-02-19", "1969-12-29/1970-01-04"],
      "W-MON": ["2012-02-14/2012-02-20", "1969-12-30/1970-01-05"],
      "W-TUE": ["2012-02-08/2012-02-14", "1969-12-31/1970-01-06"],
      "W-WED": ["2012-02-09/2012-02-15", "1970-01-01/1970-01-07"],
      "W-THU": ["2012-02-10/2012-02-16", "1969-12-26/1970-01-01"],
      "W-FRI": ["2012-02-11/2012-02-17", "1969-12-27/1970-01-02"],
      "W-SAT": ["2012-02-12/2012-02-18", "1969-12-28/1970-01-03"],
      Q: ["2012Q1", "1970Q1"],
      "Q-JAN": ["2013Q1", "1970Q4"],
      "Q-FEB": ["2012Q4", "1970Q4"],
      "Q-MAR": ["2012Q4", "1970Q4"],
      "Q-APR": ["2012Q4", "1970Q3"],
      "Q-MAY": ["2012Q3", "1970Q3"],
      "Q-JUN": ["2012Q3", "1970Q3"],
      "Q-JUL": ["2012Q3", "1970Q2"],
      "Q-AUG": ["2012Q2", "1970Q2"],
      "Q-SEP": ["2012Q2", "1970Q2"],
      "Q-OCT": ["2012Q2", "1970Q1"],
      "Q-NOV": ["2012Q1", "1970Q1"],
      "Q-DEC": ["2012Q1", "1970Q1"],
    })
  })

  it("period from a pyarrow.Table without pandas metadata", () => {
    // Only the `pandas.period` extension tag marks the column as a period.
    const q = new Quiver({ data: PERIOD_EXTENSION })
    const { content, contentType } = q.getCell(0, 0)

    expect(contentType.pandasType).toBeUndefined()
    expect(format(content, contentType)).toEqual("2020-01")
    expect(format(content, contentType)).not.toEqual(String(content))
  })

  it.each([
    // [categories, arrow data, column index, expected]
    ["pd.cut", INTERVAL_CATEGORICAL, 0, "(0, 1]"],
    ["dictionary-encoded period", PERIOD_EXTENSION, 1, "2020-02"],
  ])(
    "formats %s categories with the category type",
    (_name, data, columnIndex, expected) => {
      const { content, contentType } = new Quiver({ data }).getCell(
        0,
        columnIndex
      )

      expect(format(content, contentType)).toEqual(expected)
    }
  )

  it("list[unicode]", () => {
    expect(
      format(vectorFromArray(["foo", "bar", "baz"]), {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new List(new Field("test", new Utf8(), true)),
          true
        ),
        pandasType: undefined,
      })
    ).toEqual('["foo","bar","baz"]')
  })

  it("time as bigint with sub-second precision uses fractional format", () => {
    expect(
      format(BigInt(1500), {
        type: DataFrameCellType.DATA,
        arrowField: new Field("t", new Time(TimeUnit.MILLISECOND, 64), true),
        pandasType: {
          field_name: "t",
          name: "t",
          pandas_type: "time",
          numpy_type: "time",
          metadata: null,
        },
      })
    ).toEqual("00:00:01.500")
  })

  it.each([
    { value: 3723, unit: TimeUnit.SECOND, expected: "01:02:03" },
    { value: 3723456, unit: TimeUnit.MILLISECOND, expected: "01:02:03.456" },
  ])(
    "time32 value $value formats as $expected",
    ({ value, unit, expected }) => {
      expect(
        format(value, {
          type: DataFrameCellType.DATA,
          arrowField: new Field("t", new Time(unit, 32), true),
          pandasType: undefined,
        })
      ).toEqual(expected)
    }
  )

  it("timedelta via pandas metadata uses nanosecond unit when arrow field has no unit", () => {
    expect(
      format(BigInt(86_400_000_000_000), {
        type: DataFrameCellType.DATA,
        arrowField: new Field("td", new Int64(), true),
        pandasType: {
          field_name: "td",
          name: "td",
          pandas_type: "object",
          numpy_type: "timedelta64[ns]",
          metadata: null,
        },
      })
    ).toEqual("a day")
  })

  it("negative timedelta keeps a leading minus", () => {
    expect(
      format(BigInt(-3 * 86_400_000_000_000), {
        type: DataFrameCellType.DATA,
        arrowField: new Field("td", new Int64(), true),
        pandasType: {
          field_name: "td",
          name: "td",
          pandas_type: "object",
          numpy_type: "timedelta64[ns]",
          metadata: null,
        },
      })
    ).toMatch(/^-/)
  })

  it("decimal with scale 0 returns integer string", () => {
    const builder = new DecimalBuilder({
      type: new Decimal(0, 10),
      nullValues: null,
    })
    builder.append(new Uint32Array([42, 0, 0, 0]))
    const value = builder.finish().toVector().get(0)
    const arrowType = {
      type: DataFrameCellType.DATA,
      arrowField: new Field("c", new Decimal(0, 10), true),
      pandasType: {
        field_name: "c",
        name: "c",
        pandas_type: "decimal",
        numpy_type: "object",
        metadata: null,
      },
    }
    expect(format(value, arrowType)).toEqual("42")
  })

  it.each([
    { unscaled: 5, scale: 2, expected: "0.05" },
    { unscaled: -5, scale: 2, expected: "-0.05" },
    { unscaled: -5, scale: 3, expected: "-0.005" },
    { unscaled: -12, scale: 3, expected: "-0.012" },
    { unscaled: -12345, scale: 2, expected: "-123.45" },
    { unscaled: 123, scale: -2, expected: "12300" },
    { unscaled: -123, scale: -4, expected: "-1230000" },
    { unscaled: 0, scale: -2, expected: "0" },
  ])(
    "decimal $unscaled with scale $scale formats as $expected",
    ({ unscaled, scale, expected }) => {
      const decimalType = new Decimal(scale, 10)
      const builder = new DecimalBuilder({
        type: decimalType,
        nullValues: null,
      })
      // Little-endian 128-bit two's complement words.
      const fill = unscaled < 0 ? 0xffffffff : 0
      builder.append(new Uint32Array([unscaled >>> 0, fill, fill, fill]))
      const value = builder.finish().toVector().get(0)
      const arrowType = {
        type: DataFrameCellType.DATA,
        arrowField: new Field("c", decimalType, true),
        pandasType: {
          field_name: "c",
          name: "c",
          pandas_type: "decimal",
          numpy_type: "object",
          metadata: null,
        },
      }

      expect(format(value, arrowType)).toEqual(expected)
    }
  )

  it("list JSON coerces bigint with Number() for serialization", () => {
    expect(
      format([{ x: BigInt("9007199254740993") }] as never, {
        type: DataFrameCellType.DATA,
        arrowField: new Field(
          "test",
          new List(new Field("item", new Utf8(), true)),
          true
        ),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "object",
          numpy_type: "list[object]",
          metadata: null,
        },
      })
    ).toEqual('[{"x":9007199254740992}]')
  })

  it("interval without pandas extension metadata falls back to string", () => {
    const intervalStruct = new Struct([
      new Field("left", new Float64(), true),
      new Field("right", new Float64(), true),
    ])
    const row = vectorFromArray([{ left: 0, right: 1 }], intervalStruct).get(0)
    const result = format(row, {
      type: DataFrameCellType.DATA,
      arrowField: new Field("iv", intervalStruct, true),
      pandasType: {
        field_name: "iv",
        name: "iv",
        pandas_type: "object",
        numpy_type: "interval[float64, float64]",
        metadata: null,
      },
    })
    expect(result).toBe(String(row))
  })

  it("period column with missing arrow extension metadata returns raw duration", () => {
    expect(
      format(BigInt(5), {
        type: DataFrameCellType.DATA,
        arrowField: new Field("p", new Int64(), true),
        pandasType: PERIOD_DAY_PANDAS_TYPE,
      })
    ).toEqual("5")
  })

  it("period column with wrong extension name returns raw duration", () => {
    const meta = new Map<string, string>([
      ["ARROW:extension:name", "notpandas.period"],
      ["ARROW:extension:metadata", JSON.stringify({ freq: "D" })],
    ])
    expect(
      format(BigInt(5), {
        type: DataFrameCellType.DATA,
        arrowField: new Field("p", new Int64(), true, meta),
        pandasType: PERIOD_DAY_PANDAS_TYPE,
      })
    ).toEqual("5")
  })

  it("period column with missing freq in extension metadata returns raw duration", () => {
    const meta = new Map<string, string>([
      ["ARROW:extension:name", "pandas.period"],
      ["ARROW:extension:metadata", JSON.stringify({})],
    ])
    expect(
      format(BigInt(5), {
        type: DataFrameCellType.DATA,
        arrowField: new Field("p", new Int64(), true, meta),
        pandasType: PERIOD_DAY_PANDAS_TYPE,
      })
    ).toEqual("5")
  })

  it("period column with non-string freq returns raw duration", () => {
    const meta = new Map<string, string>([
      ["ARROW:extension:name", "pandas.period"],
      ["ARROW:extension:metadata", JSON.stringify({ freq: 1 })],
    ])
    expect(
      format(BigInt(5), {
        type: DataFrameCellType.DATA,
        arrowField: new Field("p", new Int64(), true, meta),
        pandasType: PERIOD_DAY_PANDAS_TYPE,
      })
    ).toEqual("5")
  })

  it("non-finite float falls through to string coercion", () => {
    const floatType = {
      type: DataFrameCellType.DATA,
      arrowField: new Field("f", new Float64(), true),
      pandasType: undefined,
    }
    expect(format(Number.NaN, floatType)).toEqual("NaN")
    expect(format(Number.POSITIVE_INFINITY, floatType)).toEqual("Infinity")
  })

  it("returns String(x) when an unsupported type is encountered", () => {
    // A boolean type does not match any explicit branch in format(), so the
    // function should return String(x) at the end (post-try block).
    expect(
      format(false, {
        type: DataFrameCellType.DATA,
        arrowField: new Field("test", new Bool(), true),
        pandasType: {
          field_name: "test",
          name: "test",
          pandas_type: "bool",
          numpy_type: "bool",
          metadata: null,
        },
      })
    ).toEqual("false")
  })

  it("falls back to string coercion when interval metadata fails to parse", () => {
    // Provide a pandas.interval extension marker but invalid JSON metadata,
    // which causes JSON.parse to throw inside formatInterval and triggers the
    // top-level catch in format().
    const LOG = getLogger("arrowFormatUtils")
    const warnSpy = vi.spyOn(LOG, "warn").mockImplementation(() => {})

    const meta = new Map<string, string>([
      ["ARROW:extension:name", "pandas.interval"],
      ["ARROW:extension:metadata", "{not-valid-json"],
    ])
    const intervalStruct = new Struct([
      new Field("left", new Float64(), true),
      new Field("right", new Float64(), true),
    ])
    const row = vectorFromArray([{ left: 0, right: 1 }], intervalStruct).get(0)
    const result = format(row, {
      type: DataFrameCellType.DATA,
      arrowField: new Field("iv", intervalStruct, true, meta),
      pandasType: {
        field_name: "iv",
        name: "iv",
        pandas_type: "object",
        numpy_type: "interval[float64, float64]",
        metadata: null,
      },
    })
    expect(result).toBe(String(row))
    // Verify the top-level catch handler ran by checking LOG.warn was called.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unexpected error")
    )
    warnSpy.mockRestore()
  })

  it.each([
    {
      label: "metadata is missing",
      metadata: new Map<string, string>([
        ["ARROW:extension:name", "pandas.interval"],
      ]),
      warning: "Arrow interval extension metadata is missing",
    },
    {
      label: "closed is null",
      metadata: new Map<string, string>([
        ["ARROW:extension:name", "pandas.interval"],
        [
          "ARROW:extension:metadata",
          JSON.stringify({ subtype: "float64", closed: null }),
        ],
      ]),
      warning:
        "Arrow interval extension metadata must include string subtype and closed",
    },
    {
      label: "subtype is missing",
      metadata: new Map<string, string>([
        ["ARROW:extension:name", "pandas.interval"],
        ["ARROW:extension:metadata", JSON.stringify({ closed: "right" })],
      ]),
      warning:
        "Arrow interval extension metadata must include string subtype and closed",
    },
  ])(
    "falls back to string coercion when interval $label",
    ({ metadata, warning }) => {
      const LOG = getLogger("arrowFormatUtils")
      const warnSpy = vi.spyOn(LOG, "warn").mockImplementation(() => {})

      const intervalStruct = new Struct([
        new Field("left", new Float64(), true),
        new Field("right", new Float64(), true),
      ])
      const row = vectorFromArray([{ left: 0, right: 1 }], intervalStruct).get(
        0
      )
      const result = format(row, {
        type: DataFrameCellType.DATA,
        arrowField: new Field("iv", intervalStruct, true, metadata),
        pandasType: {
          field_name: "iv",
          name: "iv",
          pandas_type: "object",
          numpy_type: "interval[float64, float64]",
          metadata: null,
        },
      })
      expect(result).toBe(String(row))
      expect(warnSpy).toHaveBeenCalledWith(warning)
      warnSpy.mockRestore()
    }
  )
})

describe("formatPeriodFromFreq", () => {
  it("returns string for period value outside safe integer range", () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(2)
    expect(formatPeriodFromFreq(huge, "D")).toEqual(String(huge))
  })

  it.each([
    // Basic frequencies
    [1, "Y", "1971"],
    [1, "M", "1970-02"],
    [1, "D", "1970-01-02"],
    [1, "h", "1970-01-01 01:00"],
    [1, "min", "1970-01-01 00:01"],
    [1, "s", "1970-01-01 00:00:01"],
    [1, "ms", "1970-01-01 00:00:00.001"],
    // Weekly frequencies
    [1, "W-MON", "1969-12-30/1970-01-05"],
    [1, "W-TUE", "1969-12-31/1970-01-06"],
    [1, "W-WED", "1970-01-01/1970-01-07"],
    [1, "W-THU", "1970-01-02/1970-01-08"],
    [1, "W-FRI", "1970-01-03/1970-01-09"],
    [1, "W-SAT", "1970-01-04/1970-01-10"],
    [1, "W-SUN", "1969-12-29/1970-01-04"],
    // Invalid frequencies
    [1, "invalid", "1"],
    [1, "W", "1"],
    [1, "W-INVALID", "1"],
  ])("formats %s with frequency %s to %s", (value, freq, expected) => {
    expect(
      formatPeriodFromFreq(
        value,
        freq as Parameters<typeof formatPeriodFromFreq>[1]
      )
    ).toEqual(expected)
  })
})

describe("convertTimeToDate", () => {
  it.each([
    // [timestamp, unit, expected date string]
    [1000, TimeUnit.SECOND, "1970-01-01T00:16:40.000Z"],
    [1000, TimeUnit.MILLISECOND, "1970-01-01T00:00:01.000Z"],
    [1000, TimeUnit.MICROSECOND, "1970-01-01T00:00:00.001Z"],
    [1000, TimeUnit.NANOSECOND, "1970-01-01T00:00:00.000Z"],
    // Test with BigInt values
    [BigInt(1000), TimeUnit.SECOND, "1970-01-01T00:16:40.000Z"],
    [BigInt(1000), TimeUnit.MILLISECOND, "1970-01-01T00:00:01.000Z"],
    [
      BigInt(10368000) * BigInt(1000000000) + BigInt(500),
      TimeUnit.NANOSECOND,
      "1970-05-01T00:00:00.000Z",
    ],
    // Test with undefined field (should default to SECOND)
    [1000, undefined, "1970-01-01T00:16:40.000Z"],
    // Test with large timestamps
    [1647356400, TimeUnit.SECOND, "2022-03-15T15:00:00.000Z"],
    [1647356400000, TimeUnit.MILLISECOND, "2022-03-15T15:00:00.000Z"],
  ])("converts time %s with unit %s to %s", (timestamp, unit, expected) => {
    const result = convertTimeToDate(
      timestamp,
      unit ? new Field("test", new Timestamp(unit), true, null) : undefined
    )
    expect(result.toISOString()).toBe(expected)
  })
})

describe("convertDurationToMilliseconds", () => {
  // 120 days plus 0.123456789 seconds: above Number.MAX_SAFE_INTEGER in ns.
  const unsafeNanoseconds =
    BigInt(10_368_000) * BigInt(1_000_000_000) + BigInt(123_456_789)

  it.each([
    // [duration, unit, expected milliseconds]
    [1_500_000, TimeUnit.NANOSECOND, 1.5],
    [BigInt(1_500_000), TimeUnit.NANOSECOND, 1.5],
    [BigInt(-1_500_000), TimeUnit.NANOSECOND, -1.5],
    [1500, TimeUnit.MICROSECOND, 1.5],
    [BigInt(1500), TimeUnit.MICROSECOND, 1.5],
    [1500, TimeUnit.MILLISECOND, 1500],
    [BigInt(1500), TimeUnit.MILLISECOND, 1500],
    [2, TimeUnit.SECOND, 2000],
    [BigInt(-2), TimeUnit.SECOND, -2000],
    // Without a field, the value is read as nanoseconds (the pandas default).
    [1_500_000, undefined, 1.5],
    // Divided straight to milliseconds: going through seconds would give
    // 20.987638999999998.
    [20_987_639, TimeUnit.NANOSECOND, 20.987639],
    // Unsafe bigints are divided as bigints and keep the sub-millisecond
    // remainder.
    [unsafeNanoseconds, TimeUnit.NANOSECOND, 10_368_000_123 + 0.456789],
    [-unsafeNanoseconds, TimeUnit.NANOSECOND, -(10_368_000_123 + 0.456789)],
    [
      BigInt(Number.MAX_SAFE_INTEGER) * BigInt(10) + BigInt(7),
      TimeUnit.MICROSECOND,
      90_071_992_547_409 + 0.917,
    ],
  ])(
    "converts duration %s with unit %s to %s ms",
    (duration, unit, expected) => {
      const field =
        unit === undefined
          ? undefined
          : new Field("test", new Duration(unit), true, null)
      expect(convertDurationToMilliseconds(duration, field)).toBe(expected)
    }
  )

  it("keeps sub-millisecond fractions of a safe bigint", () => {
    const field = new Field(
      "test",
      new Duration(TimeUnit.NANOSECOND),
      true,
      null
    )
    const result = convertDurationToMilliseconds(BigInt(1_234_567), field)
    expect(result).toBe(1.234567)
    expect(Number.isInteger(result)).toBe(false)
  })
})

const HAS_INTL_DURATION_FORMAT =
  typeof (Intl as { DurationFormat?: unknown }).DurationFormat === "function"

describe("formatDurationFromSeconds", () => {
  it.each(["duration", "compact", "localized"] as const)(
    "returns the string form of non-finite values for %s",
    format => {
      expect(formatDurationFromSeconds(Number.POSITIVE_INFINITY, format)).toBe(
        "Infinity"
      )
      expect(formatDurationFromSeconds(Number.NaN, format)).toBe("NaN")
    }
  )

  describe("duration format", () => {
    it("humanizes a positive duration by default", () => {
      expect(formatDurationFromSeconds(5)).toEqual("a few seconds")
      expect(formatDurationFromSeconds(7200, "duration")).toMatch(/hour/i)
    })

    it("prefixes a minus for negative durations", () => {
      expect(formatDurationFromSeconds(-7200)).toMatch(/^-/)
    })
  })

  describe("compact format", () => {
    it("formats a duration as an elapsed-time clock", () => {
      expect(formatDurationFromSeconds(5, "compact")).toEqual("00:00:05")
      expect(formatDurationFromSeconds(14 * 24 * 60 * 60, "compact")).toEqual(
        "336:00:00"
      )
      expect(formatDurationFromSeconds(-7200, "compact")).toEqual("-02:00:00")
    })

    it("includes fractional seconds up to the requested precision", () => {
      expect(formatDurationFromSeconds(1.5, "compact", 3)).toEqual(
        "00:00:01.5"
      )
      expect(formatDurationFromSeconds(1.00025, "compact", 6)).toEqual(
        "00:00:01.00025"
      )
      expect(formatDurationFromSeconds(0.000000125, "compact", 9)).toEqual(
        "00:00:00.000000125"
      )
      expect(formatDurationFromSeconds(-0.5, "compact", 3)).toEqual(
        "-00:00:00.5"
      )
    })

    it("omits fractional seconds for whole values", () => {
      expect(formatDurationFromSeconds(1, "compact", 9)).toEqual("00:00:01")
    })

    it("does not round unsupported fractions into whole seconds", () => {
      expect(formatDurationFromSeconds(1.5, "compact", 0)).toEqual("00:00:01")
    })
  })

  describe("localized format", () => {
    it.skipIf(!HAS_INTL_DURATION_FORMAT)(
      "formats an exact locale duration using short units",
      () => {
        expect(formatDurationFromSeconds(5, "localized")).toEqual("5 sec")
        expect(formatDurationFromSeconds(7200, "localized")).toEqual("2 hr")
        expect(formatDurationFromSeconds(1.5, "localized", 3)).toEqual(
          "1 sec, 500 ms"
        )
        expect(formatDurationFromSeconds(0.00025, "localized", 6)).toEqual(
          "250 μs"
        )
        expect(formatDurationFromSeconds(0.000000125, "localized", 9)).toEqual(
          "125 ns"
        )
      }
    )

    it.skipIf(!HAS_INTL_DURATION_FORMAT)(
      "shows a zero duration instead of an empty string",
      () => {
        expect(formatDurationFromSeconds(0, "localized")).toEqual("0 sec")
        // Below the column unit, the value is also a zero duration.
        expect(formatDurationFromSeconds(0.0004, "localized", 3)).toEqual(
          "0 sec"
        )
        // Other durations do not gain a zero seconds part.
        expect(formatDurationFromSeconds(7200, "localized")).toEqual("2 hr")
      }
    )

    it("prefixes a minus for negative durations", () => {
      expect(formatDurationFromSeconds(-7200, "localized")).toMatch(/^-/)
    })

    it("falls back to the elapsed-time clock when Intl.DurationFormat is missing", () => {
      const intlObject = Intl as unknown as { DurationFormat?: unknown }
      const original = intlObject.DurationFormat
      intlObject.DurationFormat = undefined
      try {
        expect(formatDurationFromSeconds(5, "localized")).toEqual("00:00:05")
        expect(formatDurationFromSeconds(-7200, "localized")).toEqual(
          "-02:00:00"
        )
        expect(formatDurationFromSeconds(1.5, "localized", 3)).toEqual(
          "00:00:01.5"
        )
      } finally {
        intlObject.DurationFormat = original
      }
    })

    it("falls back to the elapsed-time clock when the default-locale retry also fails", async () => {
      const intlObject = Intl as unknown as { DurationFormat?: unknown }
      const original = intlObject.DurationFormat
      intlObject.DurationFormat = function ThrowingDurationFormat() {
        return {
          format: (): string => {
            throw new RangeError("Unsupported duration")
          },
        }
      }
      // Reload the module so its formatter cache starts empty.
      vi.resetModules()
      try {
        const { formatDurationFromSeconds: formatWithThrowingIntl } =
          await import("./arrowFormatUtils")
        expect(formatWithThrowingIntl(5, "localized")).toEqual("00:00:05")
      } finally {
        intlObject.DurationFormat = original
      }
    })
  })
})

describe("getDurationFractionalSecondDigits", () => {
  it.each([
    [TimeUnit.SECOND, 0],
    [TimeUnit.MILLISECOND, 3],
    [TimeUnit.MICROSECOND, 6],
    [TimeUnit.NANOSECOND, 9],
  ])("returns the second decimals for unit %s", (unit, expected) => {
    const field = new Field("duration", new Duration(unit), true)
    expect(getDurationFractionalSecondDigits(field)).toBe(expected)
  })

  it("reads a field without a unit as nanoseconds", () => {
    expect(getDurationFractionalSecondDigits(undefined)).toBe(9)
  })
})

describe("isValidDurationSeconds", () => {
  it("accepts values the unit can represent", () => {
    expect(isValidDurationSeconds(90, 0)).toBe(true)
    expect(isValidDurationSeconds(1.5, 3)).toBe(true)
    expect(isValidDurationSeconds(-0.000000125, 9)).toBe(true)
  })

  it("rejects values finer than the unit", () => {
    expect(isValidDurationSeconds(90.5, 0)).toBe(false)
    expect(isValidDurationSeconds(1.0005, 3)).toBe(false)
    expect(isValidDurationSeconds(90.0000000005, 9)).toBe(false)
  })

  it("rejects values finer than the unit near the pandas Timedelta limit", () => {
    // About 285 years: a relative tolerance alone would accept this
    // sub-millisecond value on timedelta64[ms]. Written as a sum because the
    // float cannot hold the exact decimal.
    expect(isValidDurationSeconds(9_000_000_000 + 0.000001, 3)).toBe(false)
    expect(isValidDurationSeconds(9_000_000_000.001, 3)).toBe(true)
    expect(isValidDurationSeconds(9_000_000_000, 0)).toBe(true)
  })

  it.each([
    ["105 days + 123 ns", 105, 123],
    ["-105 days - 123 ns", -105, -123],
    ["104 days + 999999999 ns", 104, 999_999_999],
    ["200 days + 1 ns", 200, 1],
  ])(
    "accepts the second count converted from a %s tick",
    (_label, days, nanoseconds) => {
      // Past 2^53 ns (about 104 days), the float second count cannot round-trip
      // to the exact tick, but it still represents a valid duration.
      const ticks =
        BigInt(days * 86_400) * BigInt(1_000_000_000) + BigInt(nanoseconds)
      const seconds = convertTimestampToSeconds(ticks, TimeUnit.NANOSECOND)
      expect(isValidDurationSeconds(seconds, 9)).toBe(true)
    }
  )

  it("rejects values outside the pandas Timedelta range", () => {
    const maxSeconds = 2 ** 63 / 1e9
    expect(isValidDurationSeconds(maxSeconds, 0)).toBe(false)
    expect(isValidDurationSeconds(-maxSeconds, 0)).toBe(false)
    expect(isValidDurationSeconds(Number.POSITIVE_INFINITY, 9)).toBe(false)
  })
})

describe("convertTimestampToSeconds", () => {
  it("keeps sub-second remainder for nanosecond bigints outside the safe integer range", () => {
    // 200 days + 250ms in nanoseconds overflows Number.MAX_SAFE_INTEGER.
    const twoHundredDaysNs = BigInt(200 * 24 * 60 * 60) * BigInt(1_000_000_000)
    const remainderNs = BigInt(250_000_000)
    expect(
      convertTimestampToSeconds(
        twoHundredDaysNs + remainderNs,
        TimeUnit.NANOSECOND
      )
    ).toBe(200 * 24 * 60 * 60 + 0.25)
  })

  it("keeps a negative sub-second remainder for overflowing nanosecond bigints", () => {
    const twoHundredDaysNs = BigInt(200 * 24 * 60 * 60) * BigInt(1_000_000_000)
    const remainderNs = BigInt(250_000_000)
    expect(
      convertTimestampToSeconds(
        -(twoHundredDaysNs + remainderNs),
        TimeUnit.NANOSECOND
      )
    ).toBe(-(200 * 24 * 60 * 60 + 0.25))
  })
})
