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
  type DataType as ArrowDataType,
  Binary,
  Bool,
  Decimal,
  Dictionary,
  Duration,
  Field,
  FixedSizeBinary,
  Float64,
  Int64,
  Int8,
  List,
  Null,
  Struct,
  Table,
  tableToIPC,
  Time,
  Timestamp,
  TimeUnit,
  Uint64,
  Utf8,
  vectorFromArray,
} from "apache-arrow"

import type { ArrowNamedDataSet } from "@streamlit/protobuf"

import { Quiver } from "~lib/dataframes/Quiver"
import { MULTI } from "~lib/mocks/arrow/multi"
import { NAMED_INDEX } from "~lib/mocks/arrow/namedIndex"
import { CATEGORICAL_COLUMN } from "~lib/mocks/arrow/types/categoricalColumn"
import { DATE, DATETIME, DATETIMETZ } from "~lib/mocks/arrow/types/datetime"
import { DECIMAL } from "~lib/mocks/arrow/types/decimal"
import { DICTIONARY } from "~lib/mocks/arrow/types/dictionary"
import { FLOAT64 } from "~lib/mocks/arrow/types/float64"
import { INT64 } from "~lib/mocks/arrow/types/int64"
import { INTERVAL_CATEGORICAL } from "~lib/mocks/arrow/types/intervalCategorical"
import { INTERVAL_INT64 } from "~lib/mocks/arrow/types/intervalInt64"
import { MIXED_DTYPES } from "~lib/mocks/arrow/types/mixedDtypes"
import { PERIOD } from "~lib/mocks/arrow/types/period"
import { PERIOD_EXTENSION } from "~lib/mocks/arrow/types/periodExtension"
import { RANGE } from "~lib/mocks/arrow/types/range"
import { TIMEDELTA } from "~lib/mocks/arrow/types/timedelta"
import { UINT64 } from "~lib/mocks/arrow/types/uint64"
import { UNICODE } from "~lib/mocks/arrow/types/unicode"

import {
  hydrateArrowDatasetSources,
  quiverToEChartsRows,
} from "./arrowDataset"

/**
 * Asserts that a value is something ECharts can read from `dataset.source`:
 * `null`, a boolean, a finite number, a string, or a plain array of those.
 * Arrow leftovers (bigint, Date, typed arrays, Vector, StructRow) must not leak.
 */
function expectJsonLike(value: unknown): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return
  }
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true)
    return
  }
  expect(Array.isArray(value)).toBe(true)
  expect(Object.getPrototypeOf(value)).toBe(Array.prototype)
  for (const item of value as unknown[]) {
    expectJsonLike(item)
  }
}

/** Asserts that rows are plain objects of JSON-like values. */
function expectJsonLikeRows(rows: Record<string, unknown>[]): void {
  for (const row of rows) {
    expect(Object.getPrototypeOf(row)).toBe(Object.prototype)
    for (const value of Object.values(row)) {
      expectJsonLike(value)
    }
  }
}

function toRows(data: Uint8Array): Record<string, unknown>[] {
  return quiverToEChartsRows(new Quiver({ data }))
}

interface ArrowColumn {
  values: unknown[]
  type: ArrowDataType
}

function tableBytes(columns: Record<string, ArrowColumn>): Uint8Array {
  const vectors = Object.fromEntries(
    Object.entries(columns).map(([name, { values, type }]) => [
      name,
      vectorFromArray(values, type),
    ])
  )
  return tableToIPC(new Table(vectors), "stream")
}

describe("quiverToEChartsRows", () => {
  it.each([
    {
      name: "FLOAT64",
      data: FLOAT64,
      expected: [
        { "1.24": 1.2, "2.35": 1.3 },
        { "1.24": 1.4, "2.35": 1.5 },
      ],
    },
    {
      name: "INT64",
      data: INT64,
      expected: [
        { "1": 0, "2": 1 },
        { "1": 2, "2": 3 },
      ],
    },
    {
      name: "UINT64",
      data: UINT64,
      expected: [
        { "1": 1, "2": 2 },
        { "1": 3, "2": 4 },
      ],
    },
    {
      name: "UNICODE",
      data: UNICODE,
      expected: [
        { c1: "foo", c2: "1" },
        { c1: "bar", c2: "2" },
      ],
    },
    {
      name: "CATEGORICAL_COLUMN",
      data: CATEGORICAL_COLUMN,
      expected: [
        { c1: "foo", c2: 100 },
        { c1: "bar", c2: 200 },
      ],
    },
    {
      name: "DICTIONARY (struct cells)",
      data: DICTIONARY,
      expected: [
        { c1: '{"a":1,"b":2}', c2: '{"a":3,"b":4}' },
        { c1: '{"c":"foo","d":2}', c2: '{"a":5}' },
      ],
    },
    {
      name: "DECIMAL",
      data: DECIMAL,
      expected: [
        { c1: 1.1, c2: 2.23 },
        { c1: 10000, c2: -0.1 },
      ],
    },
    {
      name: "DATETIME (naive, no Z)",
      data: DATETIME,
      expected: [
        {
          "2000-12-31 00:00:00": "2020-01-02T05:00:00.000",
          "2001-12-31 00:00:00": "2020-10-20T05:00:00.000",
        },
        {
          "2000-12-31 00:00:00": "2020-01-02T05:00:00.000",
          "2001-12-31 00:00:00": "2020-10-20T05:00:00.000",
        },
      ],
    },
    {
      name: "DATETIMETZ (with Z)",
      data: DATETIMETZ,
      expected: [
        {
          "2000-12-31 00:00:00": "2020-01-02T05:00:00.000Z",
          "2001-12-31 00:00:00": "2020-10-20T05:00:00.000Z",
        },
        {
          "2000-12-31 00:00:00": "2020-01-02T05:00:00.000Z",
          "2001-12-31 00:00:00": "2020-10-20T05:00:00.000Z",
        },
      ],
    },
    {
      name: "DATE",
      data: DATE,
      expected: [
        {
          "2000-12-31 00:00:00": "2020-01-02",
          "2001-12-31 00:00:00": "2020-10-20",
        },
        {
          "2000-12-31 00:00:00": "2020-01-02",
          "2001-12-31 00:00:00": "2020-10-20",
        },
      ],
    },
    {
      name: "TIMEDELTA (milliseconds)",
      data: TIMEDELTA,
      expected: [
        { c1: 5000, c2: 1_728_000_000 },
        { c1: 15_000_000, c2: 7_200_000 },
      ],
    },
    {
      name: "INTERVAL_INT64 (interval column labels)",
      data: INTERVAL_INT64,
      expected: [
        { "(0, 1]": "foo", "(1, 2]": 100 },
        { "(0, 1]": "bar", "(1, 2]": 200 },
      ],
    },
    {
      name: "INTERVAL_CATEGORICAL (pd.cut)",
      data: INTERVAL_CATEGORICAL,
      expected: [
        { bin: "(0, 1]", count: 1 },
        { bin: "(1, 2]", count: 2 },
        { bin: "(2, 3]", count: 3 },
      ],
    },
    {
      name: "NAMED_INDEX",
      data: NAMED_INDEX,
      expected: [
        { c1: "foo", c2: 1 },
        { c1: "bar", c2: 2 },
      ],
    },
    {
      name: "RANGE",
      data: RANGE,
      expected: [
        { "0": "foo", "1": "1" },
        { "0": "bar", "1": "2" },
      ],
    },
    {
      name: "MULTI (MultiIndex columns and rows)",
      data: MULTI,
      expected: [
        { "('1', 'red')": "foo", "('2', 'blue')": "1" },
        { "('1', 'red')": "bar", "('2', 'blue')": "2" },
      ],
    },
  ])(
    "converts the $name fixture to data-column rows",
    ({ data, expected }) => {
      const rows = toRows(data)

      expect(rows).toEqual(expected)
      expectJsonLikeRows(rows)
    }
  )

  it.each([
    { name: "NAMED_INDEX", data: NAMED_INDEX, indexKeys: ["INDEX"] },
    {
      name: "UNICODE",
      data: UNICODE,
      indexKeys: ["__index_level_0__", ""],
    },
    { name: "RANGE", data: RANGE, indexKeys: [""] },
    { name: "MULTI", data: MULTI, indexKeys: ["number", "color"] },
  ])("never emits the $name index columns", ({ data, indexKeys }) => {
    const quiver = new Quiver({ data })
    expect(quiver.dimensions.numIndexColumns).toBeGreaterThan(0)

    const rows = quiverToEChartsRows(quiver)

    expect(rows).toHaveLength(quiver.dimensions.numDataRows)
    for (const row of rows) {
      const keys = Object.keys(row)
      expect(keys).toHaveLength(quiver.dimensions.numDataColumns)
      for (const key of indexKeys) {
        expect(keys).not.toContain(key)
      }
    }
  })

  it("converts period columns to the labels st.dataframe shows", () => {
    const [first, second] = toRows(PERIOD)

    expect(first).toMatchObject({
      A: "2012",
      M: "2012-02",
      D: "2012-02-14",
      Q: "2012Q1",
      "W-SUN": "2012-02-13/2012-02-19",
    })
    expect(second).toMatchObject({ M: "1970-01", D: "1970-01-01" })
    expectJsonLikeRows([first, second])
  })

  it("converts period extension columns without pandas metadata to labels", () => {
    const rows = toRows(PERIOD_EXTENSION)

    // The dictionary-encoded column holds the categories 2020-01 and 2020-02
    // and indices [1, 0, 1]. Both columns would be period ordinals without the
    // `pandas.period` extension tag.
    expect(rows).toEqual([
      { month: "2020-01", month_cat: "2020-02", count: 1 },
      { month: "2020-02", month_cat: "2020-01", count: 2 },
      { month: "2020-03", month_cat: "2020-02", count: 3 },
    ])
    expectJsonLikeRows(rows)
  })

  it("converts a pandas frame with mixed dtypes", () => {
    const rows = toRows(MIXED_DTYPES)

    expect(rows).toEqual([
      {
        iv: "(0, 1]",
        p: "2020-01",
        cat_dt: "2020-01-01T00:00:00.000",
        d: "2020-01-01",
        ts: "2020-01-01T05:06:07.123",
        // 05:00 in New York is 10:00 UTC.
        tstz: "2020-01-01T10:00:00.000Z",
        td: 1.5,
        // Time-of-day values become text, not epoch milliseconds.
        t: "01:02:03",
        dec: 1.1,
        nint: 1,
        flt: 1.5,
        b: true,
      },
      {
        iv: "(1, 2]",
        p: "2020-02",
        cat_dt: "2020-01-02T00:00:00.000",
        d: "2020-01-02",
        ts: null,
        tstz: "2020-01-02T05:00:00.000Z",
        td: 86_400_000,
        t: "04:05:06.500",
        dec: -2.25,
        nint: null,
        // Infinity becomes null, like a missing value.
        flt: null,
        b: false,
      },
      {
        iv: "(2, 3]",
        p: "2020-03",
        cat_dt: "2020-01-01T00:00:00.000",
        d: null,
        ts: "2020-01-03T00:00:00.000",
        tstz: "2020-01-03T05:00:00.000Z",
        td: null,
        t: null,
        dec: null,
        nint: 3,
        flt: null,
        b: null,
      },
    ])
    expectJsonLikeRows(rows)
  })

  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)

  it.each<{ name: string; column: ArrowColumn; expected: unknown[] }>([
    {
      name: "Time64 nanoseconds",
      column: {
        values: [BigInt(3_723_000_000_000), null],
        type: new Time(TimeUnit.NANOSECOND, 64),
      },
      expected: ["01:02:03", null],
    },
    {
      name: "Time32 milliseconds",
      column: {
        values: [3_723_500, null],
        type: new Time(TimeUnit.MILLISECOND, 32),
      },
      expected: ["01:02:03.500", null],
    },
    {
      name: "Bool",
      column: { values: [true, false, null], type: new Bool() },
      expected: [true, false, null],
    },
    {
      name: "Float64 non-finite values",
      column: {
        values: [1.5, Number.NaN, Infinity, -Infinity, null],
        type: new Float64(),
      },
      expected: [1.5, null, null, null, null],
    },
    {
      name: "Decimal with small negative values",
      column: {
        // Unscaled -5 and -50 as little-endian 128-bit two's complement.
        values: [
          new Uint32Array([-5 >>> 0, 0xffffffff, 0xffffffff, 0xffffffff]),
          new Uint32Array([-50 >>> 0, 0xffffffff, 0xffffffff, 0xffffffff]),
          null,
        ],
        type: new Decimal(3, 10),
      },
      expected: [-0.005, -0.05, null],
    },
    {
      name: "Decimal with a negative scale",
      column: {
        // Unscaled 123 and -5 with scale -2 are 12300 and -500.
        values: [
          new Uint32Array([123, 0, 0, 0]),
          new Uint32Array([-5 >>> 0, 0xffffffff, 0xffffffff, 0xffffffff]),
          null,
        ],
        type: new Decimal(-2, 10),
      },
      expected: [12300, -500, null],
    },
    {
      name: "Uint64 above MAX_SAFE_INTEGER",
      column: { values: [maxSafe + BigInt(2)], type: new Uint64() },
      expected: [Number(maxSafe + BigInt(2))],
    },
    {
      name: "List<Float64> with null children",
      column: {
        values: [[1.5, null], null, []],
        type: new List(new Field("item", new Float64(), true)),
      },
      expected: [[1.5, null], null, []],
    },
    {
      name: "List<Int64> with null children",
      column: {
        values: [[BigInt(1), null, BigInt(3)]],
        type: new List(new Field("item", new Int64(), true)),
      },
      expected: [[1, null, 3]],
    },
    {
      name: "nested List<List<Float64>>",
      column: {
        values: [[[1, 2], null, [3]], [[]]],
        type: new List(
          new Field(
            "item",
            new List(new Field("item", new Float64(), true)),
            true
          )
        ),
      },
      expected: [[[1, 2], null, [3]], [[]]],
    },
    {
      name: "List<Timestamp>",
      column: {
        values: [[1_577_836_800_000, null]],
        type: new List(
          new Field("item", new Timestamp(TimeUnit.MILLISECOND), true)
        ),
      },
      expected: [["2020-01-01T00:00:00.000", null]],
    },
    {
      name: "Binary",
      column: {
        values: [new Uint8Array([104, 105]), null],
        type: new Binary(),
      },
      expected: ["104,105", null],
    },
    {
      name: "FixedSizeBinary",
      column: {
        values: [new Uint8Array([1, 2]), null],
        type: new FixedSizeBinary(2),
      },
      expected: ["1,2", null],
    },
    {
      name: "Struct",
      column: {
        values: [{ a: 1, b: "x" }, null],
        type: new Struct([
          new Field("a", new Float64(), true),
          new Field("b", new Utf8(), true),
        ]),
      },
      expected: ['{"a":1,"b":"x"}', null],
    },
    {
      name: "Dictionary<Timestamp>",
      column: {
        values: [1_577_836_800_000, null, 1_577_836_800_000],
        type: new Dictionary(new Timestamp(TimeUnit.MILLISECOND), new Int8()),
      },
      expected: ["2020-01-01T00:00:00.000", null, "2020-01-01T00:00:00.000"],
    },
    {
      name: "Timestamp with timezone",
      column: {
        values: [1_577_836_800_000, null],
        type: new Timestamp(TimeUnit.MILLISECOND, "UTC"),
      },
      expected: ["2020-01-01T00:00:00.000Z", null],
    },
    {
      name: "Timestamp outside the Date range",
      column: {
        values: [9e15, -1],
        type: new Timestamp(TimeUnit.MILLISECOND),
      },
      expected: [null, "1969-12-31T23:59:59.999"],
    },
    {
      name: "Duration nanoseconds",
      column: {
        // Sub-millisecond fractions are kept, also above MAX_SAFE_INTEGER.
        values: [BigInt(1_500_000), maxSafe * BigInt(2), null],
        type: new Duration(TimeUnit.NANOSECOND),
      },
      expected: [1.5, 18_014_398_509 + 0.481982, null],
    },
    {
      name: "Null",
      column: { values: [null, null], type: new Null() },
      expected: [null, null],
    },
  ])("converts a $name column", ({ column, expected }) => {
    const rows = toRows(tableBytes({ value: column }))

    expect(rows.map(row => row.value)).toEqual(expected)
    expectJsonLikeRows(rows)
  })

  it("keeps a __proto__ column as an own key without changing the prototype", () => {
    const rows = toRows(
      tableBytes({
        ["__proto__"]: { values: ["a"], type: new Utf8() },
        constructor: { values: ["b"], type: new Utf8() },
      })
    )

    expect(Object.getPrototypeOf(rows[0])).toBe(Object.prototype)
    expect(Object.keys(rows[0])).toEqual(["__proto__", "constructor"])
    expect(Object.getOwnPropertyDescriptor(rows[0], "__proto__")?.value).toBe(
      "a"
    )
    expect(rows[0].constructor).toBe("b")
  })

  it("returns no rows for a table without rows", () => {
    const rows = toRows(
      tableBytes({ value: { values: [], type: new Utf8() } })
    )

    expect(rows).toEqual([])
  })
})

describe("hydrateArrowDatasetSources", () => {
  const FIRST = tableBytes({
    product: { values: ["Matcha", "Latte"], type: new Utf8() },
    sales: { values: [43.3, 83.1], type: new Float64() },
  })
  const SECOND = tableBytes({
    x: { values: [1, 2, 3], type: new Float64() },
  })
  const FIRST_ROWS = [
    { product: "Matcha", sales: 43.3 },
    { product: "Latte", sales: 83.1 },
  ]
  const SECOND_ROWS = [{ x: 1 }, { x: 2 }, { x: 3 }]

  function namedDataset(
    name: string,
    data: Uint8Array | null
  ): ArrowNamedDataSet.$Properties {
    return { name, hasName: true, data: { data } }
  }

  const DATASETS = [namedDataset("h1", FIRST), namedDataset("h2", SECOND)]

  it("replaces a top-level placeholder with rows", () => {
    const option: Record<string, unknown> = {
      dataset: { source: { name: "h1" }, dimensions: ["product", "sales"] },
    }

    hydrateArrowDatasetSources(option, DATASETS)

    expect(option.dataset).toEqual({
      source: FIRST_ROWS,
      dimensions: ["product", "sales"],
    })
  })

  it("hydrates every dataset of a dataset list and leaves inline sources alone", () => {
    const inline = [{ product: "Mocha", sales: 1 }]
    const option: Record<string, unknown> = {
      dataset: [
        { source: { name: "h1" } },
        { source: inline },
        { source: { name: "h2" } },
        { transform: { type: "filter" } },
      ],
    }

    hydrateArrowDatasetSources(option, DATASETS)

    expect(option.dataset).toEqual([
      { source: FIRST_ROWS },
      { source: inline },
      { source: SECOND_ROWS },
      { transform: { type: "filter" } },
    ])
  })

  it("hydrates timeline and media variants", () => {
    const option = {
      media: [
        {
          query: { maxWidth: 500 },
          option: { dataset: { source: { name: "h1" } } },
        },
      ],
      baseOption: {
        dataset: { source: { name: "h1" } },
        media: [{ option: { dataset: [{ source: { name: "h2" } }] } }],
      },
      options: [
        { dataset: { source: { name: "h2" } } },
        {
          media: [{ option: { dataset: { source: { name: "h1" } } } }],
        },
        "not an object",
      ],
    }

    hydrateArrowDatasetSources(option, DATASETS)

    expect(option.media[0].option.dataset.source).toEqual(FIRST_ROWS)
    expect(option.baseOption.dataset.source).toEqual(FIRST_ROWS)
    expect(option.baseOption.media[0].option.dataset[0].source).toEqual(
      SECOND_ROWS
    )
    expect(
      (option.options[0] as { dataset: { source: unknown } }).dataset.source
    ).toEqual(SECOND_ROWS)
    expect(
      (
        option.options[1] as {
          media: { option: { dataset: { source: unknown } } }[]
        }
      ).media[0].option.dataset.source
    ).toEqual(FIRST_ROWS)
    expect(option.options[2]).toBe("not an object")
  })

  it("reuses one rows array for placeholders that share a name", () => {
    const option = {
      baseOption: { dataset: { source: { name: "h1" } } },
      options: [{ dataset: { source: { name: "h1" } } }],
    }

    hydrateArrowDatasetSources(option, DATASETS)

    expect(option.baseOption.dataset.source).toEqual(FIRST_ROWS)
    expect(option.options[0].dataset.source).toBe(
      option.baseOption.dataset.source
    )
  })

  it.each([
    { name: "a name that was not sent", source: { name: "Matcha" } },
    { name: "an extra key", source: { name: "h1", other: 1 } },
    { name: "a non-string name", source: { name: 1 } },
    { name: "a records list", source: [{ name: "h1" }] },
  ])("leaves a source with $name untouched", ({ source }) => {
    const option: Record<string, unknown> = { dataset: { source } }

    hydrateArrowDatasetSources(option, DATASETS)

    expect((option.dataset as { source: unknown }).source).toBe(source)
  })

  const MISSING_ERROR = "The data for an ECharts dataset.source is missing."
  const UNREADABLE_ERROR =
    /^The data for an ECharts dataset\.source could not be read/

  it.each([
    { name: "empty bytes", data: new Uint8Array([]), error: MISSING_ERROR },
    { name: "no bytes", data: null, error: MISSING_ERROR },
    {
      name: "bytes without a schema",
      data: new Uint8Array([1, 2, 3]),
      error: UNREADABLE_ERROR,
    },
    {
      name: "a truncated stream",
      data: SECOND.slice(0, 40),
      error: UNREADABLE_ERROR,
    },
  ])(
    "throws for a matched placeholder whose dataset has $name",
    ({ data, error }) => {
      const option = { dataset: { source: { name: "h1" } } }

      expect(() =>
        hydrateArrowDatasetSources(option, [namedDataset("h1", data)])
      ).toThrow(error)
      expect(option.dataset.source).toEqual({ name: "h1" })
    }
  )

  it("does not read datasets that no placeholder points to", () => {
    const option = { dataset: { source: { name: "h2" } } }

    expect(() =>
      hydrateArrowDatasetSources(option, [
        namedDataset("unused", new Uint8Array([1, 2, 3])),
        namedDataset("h2", SECOND),
      ])
    ).not.toThrow()
    expect(option.dataset.source).toEqual(SECOND_ROWS)
  })

  it.each([
    { name: "undefined", datasets: undefined },
    { name: "null", datasets: null },
    { name: "empty", datasets: [] },
  ])("does not walk the option for $name datasets", ({ datasets }) => {
    const option = {}
    Object.defineProperty(option, "dataset", {
      get: () => {
        throw new Error("The option must not be walked.")
      },
    })

    expect(() => {
      hydrateArrowDatasetSources(option, datasets)
    }).not.toThrow()
  })
})
