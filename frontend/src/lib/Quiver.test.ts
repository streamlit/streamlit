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

import { Field, Utf8, vectorFromArray } from "apache-arrow"
import { cloneDeep } from "lodash"

import { IndexTypeName, Quiver } from "src/lib/Quiver"
import {
  // Types
  CATEGORICAL,
  DATETIME,
  FLOAT64,
  INT64,
  INTERVAL_DATETIME64,
  INTERVAL_FLOAT64,
  INTERVAL_INT64,
  INTERVAL_UINT64,
  PERIOD,
  RANGE,
  UINT64,
  UNICODE,
  // Special cases
  EMPTY,
  MULTI,
  STYLER,
  DISPLAY_VALUES,
  FEWER_COLUMNS,
  DIFFERENT_COLUMN_TYPES,
  CATEGORICAL_INTERVAL,
} from "src/lib/mocks/arrow"

describe("Quiver", () => {
  describe("Public methods", () => {
    describe("Without Styler", () => {
      const mockElement = { data: UNICODE }
      const q = new Quiver(mockElement)

      test("cssId", () => {
        expect(q.cssId).toBeUndefined()
      })

      test("cssStyles", () => {
        expect(q.cssStyles).toBeUndefined()
      })

      test("caption", () => {
        expect(q.caption).toBeUndefined()
      })

      test("dimensions", () => {
        expect(q.dimensions).toStrictEqual({
          headerRows: 1,
          headerColumns: 1,
          dataRows: 2,
          dataColumns: 2,
          rows: 3,
          columns: 3,
        })
      })
    })

    describe("With Styler", () => {
      const mockElement = {
        data: STYLER,
        styler: {
          uuid: "FAKE_UUID",
          styles: "FAKE_CSS",
          displayValues: DISPLAY_VALUES,
          caption: "FAKE_CAPTION",
        },
      }
      const q = new Quiver(mockElement)

      test("cssId", () => {
        expect(q.cssId).toEqual("T_FAKE_UUID")
      })

      test("cssStyles", () => {
        expect(q.cssStyles).toEqual("FAKE_CSS")
      })

      test("caption", () => {
        expect(q.caption).toEqual("FAKE_CAPTION")
      })

      test("dimensions", () => {
        expect(q.dimensions).toStrictEqual({
          headerRows: 1,
          headerColumns: 1,
          dataRows: 2,
          dataColumns: 2,
          rows: 3,
          columns: 3,
        })
      })
    })

    describe("getCell", () => {
      const mockElement = { data: UNICODE }
      const q = new Quiver(mockElement)

      test("blank cell", () => {
        expect(q.getCell(0, 0)).toStrictEqual({
          type: "blank",
          cssClass: "blank",
          content: "",
        })
      })

      test("index cell", () => {
        expect(q.getCell(1, 0)).toStrictEqual({
          type: "index",
          cssClass: "row_heading level0 row0",
          cssId: undefined,
          content: "i1",
          contentType: {
            pandas_type: IndexTypeName.UnicodeIndex,
            numpy_type: "object",
            meta: null,
          },
        })
      })

      test("columns cell", () => {
        expect(q.getCell(0, 1)).toStrictEqual({
          type: "columns",
          cssClass: "col_heading level0 col0",
          content: "c1",
          contentType: {
            pandas_type: "unicode",
            numpy_type: "object",
          },
        })
      })

      test("data cell", () => {
        expect(q.getCell(1, 2)).toStrictEqual({
          type: "data",
          cssClass: "data row0 col1",
          cssId: undefined,
          content: "1",
          contentType: {
            pandas_type: "unicode",
            numpy_type: "object",
            meta: null,
          },
          field: new Field("c2", new Utf8(), true, new Map([])),
          displayContent: undefined,
        })
      })

      it("throws an exception if row index is out of range", () => {
        expect(() => q.getCell(5, 0)).toThrow("Row index is out of range: 5")
      })

      it("throws an exception if column index is out of range", () => {
        expect(() => q.getCell(0, 5)).toThrow(
          "Column index is out of range: 5"
        )
      })
    })

    describe("getTypeName", () => {
      describe("uses numpy_type", () => {
        test("period", () => {
          const mockElement = { data: PERIOD }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual("period[Q-DEC]")
        })

        test("interval datetime64[ns]", () => {
          const mockElement = { data: INTERVAL_DATETIME64 }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual(
            "interval[datetime64[ns], right]"
          )
        })

        test("interval float64", () => {
          const mockElement = { data: INTERVAL_FLOAT64 }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual(
            "interval[float64, right]"
          )
        })

        test("interval int64", () => {
          const mockElement = { data: INTERVAL_INT64 }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual(
            "interval[int64, right]"
          )
        })

        test("interval uint64", () => {
          const mockElement = { data: INTERVAL_UINT64 }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual(
            "interval[uint64, right]"
          )
        })
      })

      describe("uses pandas_type", () => {
        test("categorical", () => {
          const mockElement = { data: CATEGORICAL }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual(
            IndexTypeName.CategoricalIndex
          )
        })

        test("datetime", () => {
          const mockElement = { data: DATETIME }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual(
            IndexTypeName.DatetimeIndex
          )
        })

        test("float64", () => {
          const mockElement = { data: FLOAT64 }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual(
            IndexTypeName.Float64Index
          )
        })

        test("int64", () => {
          const mockElement = { data: INT64 }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual(
            IndexTypeName.Int64Index
          )
        })

        test("range", () => {
          const mockElement = { data: RANGE }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual(
            IndexTypeName.RangeIndex
          )
        })

        test("uint64", () => {
          const mockElement = { data: UINT64 }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual(
            IndexTypeName.UInt64Index
          )
        })

        test("unicode", () => {
          const mockElement = { data: UNICODE }
          const q = new Quiver(mockElement)
          const indexType = q.types.index[0]

          expect(Quiver.getTypeName(indexType)).toEqual(
            IndexTypeName.UnicodeIndex
          )
        })
      })
    })

    describe("format", () => {
      test("null", () => {
        expect(Quiver.format(null)).toEqual("<NA>")
      })

      test("string", () => {
        expect(Quiver.format("foo")).toEqual("foo")
      })

      test("boolean", () => {
        expect(Quiver.format(true)).toEqual("true")
      })

      test("float64", () => {
        expect(
          Quiver.format(1.25, {
            pandas_type: "float64",
            numpy_type: "float64",
          })
        ).toEqual("1.2500")
      })

      test("int64", () => {
        const mockElement = { data: INT64 }
        const q = new Quiver(mockElement)
        const { content } = q.getCell(1, 2)

        expect(
          Quiver.format(content, {
            pandas_type: "int64",
            numpy_type: "int64",
          })
        ).toEqual("1")
      })

      test("uint64", () => {
        const mockElement = { data: UINT64 }
        const q = new Quiver(mockElement)
        const { content } = q.getCell(1, 2)

        expect(
          Quiver.format(content, {
            pandas_type: "uint64",
            numpy_type: "uint64",
          })
        ).toEqual("2")
      })

      test("bytes", () => {
        expect(
          Quiver.format(new Uint8Array([1, 2, 3]), {
            pandas_type: "bytes",
            numpy_type: "bytes",
          })
        ).toEqual("1,2,3")
      })

      test("date", () => {
        expect(
          Quiver.format(new Date(Date.UTC(1970, 0, 1)), {
            pandas_type: "date",
            numpy_type: "object",
          })
        ).toEqual("1970-01-01")
      })

      test("datetime", () => {
        expect(
          Quiver.format(0, {
            pandas_type: "datetime",
            numpy_type: "datetime64[ns]",
          })
        ).toEqual("1970-01-01T00:00:00")
      })

      test("datetimetz", () => {
        expect(
          Quiver.format(0, {
            pandas_type: "datetimetz",
            numpy_type: "datetime64[ns]",
            meta: { timezone: "Europe/Moscow" },
          })
        ).toEqual("1970-01-01T03:00:00+03:00")
      })

      test("datetimetz with offset", () => {
        expect(
          Quiver.format(0, {
            pandas_type: "datetimetz",
            numpy_type: "datetime64[ns]",
            meta: { timezone: "+01:00" },
          })
        ).toEqual("1970-01-01T01:00:00+01:00")
      })

      test("interval datetime64[ns]", () => {
        const mockElement = { data: INTERVAL_DATETIME64 }
        const q = new Quiver(mockElement)
        const { content } = q.getCell(1, 0)

        expect(
          Quiver.format(content, {
            pandas_type: "object",
            numpy_type: "interval[datetime64[ns], right]",
          })
        ).toEqual("(2017-01-01T00:00:00, 2017-01-02T00:00:00]")
      })

      test("interval float64", () => {
        const mockElement = { data: INTERVAL_FLOAT64 }
        const q = new Quiver(mockElement)
        const { content } = q.getCell(1, 0)

        expect(
          Quiver.format(content, {
            pandas_type: "object",
            numpy_type: "interval[float64, right]",
          })
        ).toEqual("(0.0000, 1.5000]")
      })

      test("interval int64", () => {
        const mockElement = { data: INTERVAL_INT64 }
        const q = new Quiver(mockElement)
        const { content } = q.getCell(1, 0)

        expect(
          Quiver.format(content, {
            pandas_type: "object",
            numpy_type: "interval[int64, right]",
          })
        ).toEqual("(0, 1]")
      })

      test("interval uint64", () => {
        const mockElement = { data: INTERVAL_UINT64 }
        const q = new Quiver(mockElement)
        const { content } = q.getCell(1, 0)

        expect(
          Quiver.format(content, {
            pandas_type: "object",
            numpy_type: "interval[uint64, right]",
          })
        ).toEqual("(0, 1]")
      })

      test("categorical interval", () => {
        const mockElement = { data: CATEGORICAL_INTERVAL }
        const q = new Quiver(mockElement)
        const { content, contentType, field } = q.getCell(1, 1)

        expect(Quiver.format(content, contentType, field)).toEqual(
          "(23.535, 256.5]"
        )
      })

      test("invalid interval type", () => {
        const mockElement = { data: INTERVAL_INT64 }
        const INVALID_TYPE = "interval"
        const q = new Quiver(mockElement)
        const { content } = q.getCell(1, 0)

        expect(() =>
          Quiver.format(content, {
            pandas_type: "object",
            numpy_type: INVALID_TYPE,
          })
        ).toThrow("Invalid interval type: interval")
      })

      test("list[unicode]", () => {
        expect(
          Quiver.format(vectorFromArray(["foo", "bar", "baz"]), {
            pandas_type: "list[unicode]",
            numpy_type: "object",
          })
        ).toEqual('["foo","bar","baz"]')
      })
    })

    describe("isEmpty", () => {
      it("returns true if a DataFrame is empty", () => {
        const mockElement = { data: EMPTY }
        const q = new Quiver(mockElement)

        expect(q.isEmpty()).toBe(true)
      })

      it("returns false if a DataFrame is not empty", () => {
        const mockElement = { data: UNICODE }
        const q = new Quiver(mockElement)

        expect(q.isEmpty()).toBe(false)
      })
    })
  })

  describe("Display", () => {
    describe("Pandas index types", () => {
      test("categorical", () => {
        const mockElement = { data: CATEGORICAL }
        const q = new Quiver(mockElement)

        expect(q.index).toEqual([vectorFromArray(["i1", "i2"])])
        expect(q.columns).toEqual([["c1", "c2"]])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.CategoricalIndex,
              numpy_type: "int8",
              meta: {
                num_categories: 3,
                ordered: false,
              },
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("datetime", () => {
        const mockElement = { data: DATETIME }
        const q = new Quiver(mockElement)

        expect(q.index).toEqual([
          vectorFromArray([978220800000, 1009756800000]),
        ])
        expect(q.columns).toEqual([
          ["2000-12-31 00:00:00", "2001-12-31 00:00:00"],
        ])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          [
            new Date("2020-01-02T00:00:00.000Z"),
            new Date("2020-10-20T00:00:00.000Z"),
          ],
          [
            new Date("2020-01-02T00:00:00.000Z"),
            new Date("2020-10-20T00:00:00.000Z"),
          ],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.DatetimeIndex,
              numpy_type: "datetime64[ns]",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "date",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "date",
              numpy_type: "object",
              meta: null,
            },
          ],
        })
      })

      test("float64", () => {
        const mockElement = { data: FLOAT64 }
        const q = new Quiver(mockElement)

        expect(q.index).toEqual([vectorFromArray([1.24, 2.35])])
        expect(q.columns).toEqual([["1.24", "2.35"]])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          [1.2, 1.3],
          [1.4, 1.5],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.Float64Index,
              numpy_type: IndexTypeName.Float64Index,
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "float64",
              numpy_type: "float64",
              meta: null,
            },
            {
              pandas_type: "float64",
              numpy_type: "float64",
              meta: null,
            },
          ],
        })
      })

      test("int64", () => {
        const mockElement = { data: INT64 }
        const q = new Quiver(mockElement)

        expect(q.index).toEqual([vectorFromArray([BigInt(1), BigInt(2)])])
        expect(q.columns).toEqual([["1", "2"]])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          [BigInt(0), BigInt(1)],
          [BigInt(2), BigInt(3)],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.Int64Index,
              numpy_type: IndexTypeName.Int64Index,
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("interval datetime64[ns]", () => {
        const mockElement = { data: INTERVAL_DATETIME64 }
        const q = new Quiver(mockElement)

        expect(q.index.toString()).toEqual(
          '[{"left": 1483228800000, "right": 1483315200000},{"left": 1483315200000, "right": 1483401600000}]'
        )
        expect(q.columns).toEqual([
          ["(2017-01-01, 2017-01-02]", "(2017-01-02, 2017-01-03]"],
        ])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: "object",
              numpy_type: "interval[datetime64[ns], right]",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("interval float64", () => {
        const mockElement = { data: INTERVAL_FLOAT64 }
        const q = new Quiver(mockElement)

        expect(q.index.toString()).toEqual(
          '[{"left": 0, "right": 1.5},{"left": 1.5, "right": 3}]'
        )
        expect(q.columns).toEqual([["(0.0, 1.5]", "(1.5, 3.0]"]])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: "object",
              numpy_type: "interval[float64, right]",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("interval int64", () => {
        const mockElement = { data: INTERVAL_INT64 }
        const q = new Quiver(mockElement)

        expect(q.index.toString()).toEqual(
          '[{"left": 0, "right": 1},{"left": 1, "right": 2}]'
        )
        expect(q.columns).toEqual([["(0, 1]", "(1, 2]"]])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: "object",
              numpy_type: "interval[int64, right]",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("interval uint64", () => {
        const mockElement = { data: INTERVAL_UINT64 }
        const q = new Quiver(mockElement)

        expect(q.index.toString()).toEqual(
          '[{"left": 0, "right": 1},{"left": 1, "right": 2}]'
        )
        expect(q.columns).toEqual([["(0, 1]", "(1, 2]"]])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: "object",
              numpy_type: "interval[uint64, right]",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("range", () => {
        const mockElement = { data: RANGE }
        const q = new Quiver(mockElement)

        expect(q.index).toEqual([[0, 1]])
        expect(q.columns).toEqual([["0", "1"]])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.RangeIndex,
              numpy_type: IndexTypeName.RangeIndex,
              meta: {
                start: 0,
                step: 1,
                stop: 2,
                kind: "range",
                name: null,
              },
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
          ],
        })
      })

      test("uint64", () => {
        const mockElement = { data: UINT64 }
        const q = new Quiver(mockElement)

        expect(q.index).toEqual([vectorFromArray([BigInt(1), BigInt(2)])])
        expect(q.columns).toEqual([["1", "2"]])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          [BigInt(1), BigInt(2)],
          [BigInt(3), BigInt(4)],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.UInt64Index,
              numpy_type: IndexTypeName.UInt64Index,
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("unicode", () => {
        const mockElement = { data: UNICODE }
        const q = new Quiver(mockElement)

        expect(q.index).toEqual([vectorFromArray(["i1", "i2"])])
        expect(q.columns).toEqual([["c1", "c2"]])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.UnicodeIndex,
              numpy_type: "object",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
          ],
        })
      })
    })

    describe("Special cases", () => {
      test("empty", () => {
        const mockElement = { data: EMPTY }
        const q = new Quiver(mockElement)

        expect(q.dimensions).toStrictEqual({
          headerRows: 1,
          headerColumns: 1,
          dataRows: 0,
          dataColumns: 0,
          rows: 1,
          columns: 1,
        })

        expect(q.index).toEqual([])
        expect(q.columns).toEqual([])
        expect(q.data.toArray()).toEqual([])
        expect(q.types).toEqual({
          index: [{ pandas_type: "empty", numpy_type: "object", meta: null }],
          data: [],
        })
      })

      test("multi-index", () => {
        const mockElement = { data: MULTI }
        const q = new Quiver(mockElement)

        expect(q.index).toEqual([
          vectorFromArray([BigInt(1), BigInt(2)]),
          vectorFromArray(["red", "blue"]),
        ])
        expect(q.columns).toEqual([
          ["1", "2"],
          ["red", "blue"],
        ])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.Int64Index,
              numpy_type: "int64",
              meta: null,
            },
            {
              pandas_type: IndexTypeName.UnicodeIndex,
              numpy_type: "object",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
          ],
        })
      })

      test("styler", () => {
        const mockElement = {
          data: STYLER,
          styler: {
            uuid: "FAKE_UUID",
            styles: "FAKE_CSS",
            caption: "FAKE_CAPTION",
            displayValues: DISPLAY_VALUES,
          },
        }
        const q = new Quiver(mockElement)

        expect(q.index).toEqual([[0, 1]])
        expect(q.columns).toEqual([["0", "1"]])
        expect(q.data.toArray().map(a => a?.toArray())).toEqual([
          [BigInt(1), BigInt(2)],
          [BigInt(3), BigInt(4)],
        ])
        expect(q.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.RangeIndex,
              numpy_type: IndexTypeName.RangeIndex,
              meta: {
                start: 0,
                step: 1,
                stop: 2,
                kind: "range",
                name: null,
              },
            },
          ],
          data: [
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
        // Check display values.
        expect(q.getCell(1, 1).displayContent).toEqual("1")
        expect(q.getCell(1, 2).displayContent).toEqual("2")
        expect(q.getCell(2, 1).displayContent).toEqual("3")
        expect(q.getCell(2, 2).displayContent).toEqual("4")
      })
    })
  })

  describe("Add rows", () => {
    describe("Pandas index types", () => {
      test("categorical", () => {
        const mockElement = { data: CATEGORICAL }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index).toEqual([vectorFromArray(["i1", "i2", "i1", "i2"])])
        expect(qq.columns).toEqual([["c1", "c2"]])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.CategoricalIndex,
              numpy_type: "int8",
              meta: {
                num_categories: 3,
                ordered: false,
              },
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("datetime", () => {
        const mockElement = { data: DATETIME }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index).toEqual([
          vectorFromArray([
            978220800000, 1009756800000, 978220800000, 1009756800000,
          ]),
        ])
        expect(qq.columns).toEqual([
          ["2000-12-31 00:00:00", "2001-12-31 00:00:00"],
        ])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          [
            new Date("2020-01-02T00:00:00.000Z"),
            new Date("2020-10-20T00:00:00.000Z"),
          ],
          [
            new Date("2020-01-02T00:00:00.000Z"),
            new Date("2020-10-20T00:00:00.000Z"),
          ],
          [
            new Date("2020-01-02T00:00:00.000Z"),
            new Date("2020-10-20T00:00:00.000Z"),
          ],
          [
            new Date("2020-01-02T00:00:00.000Z"),
            new Date("2020-10-20T00:00:00.000Z"),
          ],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.DatetimeIndex,
              numpy_type: "datetime64[ns]",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "date",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "date",
              numpy_type: "object",
              meta: null,
            },
          ],
        })
      })

      test("float64", () => {
        const mockElement = { data: FLOAT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index).toEqual([vectorFromArray([1.24, 2.35, 1.24, 2.35])])
        expect(qq.columns).toEqual([["1.24", "2.35"]])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          [1.2, 1.3],
          [1.4, 1.5],
          [1.2, 1.3],
          [1.4, 1.5],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.Float64Index,
              numpy_type: IndexTypeName.Float64Index,
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "float64",
              numpy_type: "float64",
              meta: null,
            },
            {
              pandas_type: "float64",
              numpy_type: "float64",
              meta: null,
            },
          ],
        })
      })

      test("int64", () => {
        const mockElement = { data: INT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index).toEqual([
          vectorFromArray([BigInt(1), BigInt(2), BigInt(1), BigInt(2)]),
        ])
        expect(qq.columns).toEqual([["1", "2"]])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          [BigInt(0), BigInt(1)],
          [BigInt(2), BigInt(3)],
          [BigInt(0), BigInt(1)],
          [BigInt(2), BigInt(3)],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.Int64Index,
              numpy_type: IndexTypeName.Int64Index,
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("interval datetime64[ns]", () => {
        const mockElement = { data: INTERVAL_DATETIME64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index.toString()).toEqual(
          '[{"left": 1483228800000, "right": 1483315200000},{"left": 1483315200000, "right": 1483401600000},{"left": 1483228800000, "right": 1483315200000},{"left": 1483315200000, "right": 1483401600000}]'
        )
        expect(qq.columns).toEqual([
          ["(2017-01-01, 2017-01-02]", "(2017-01-02, 2017-01-03]"],
        ])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: "object",
              numpy_type: "interval[datetime64[ns], right]",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("interval float64", () => {
        const mockElement = { data: INTERVAL_FLOAT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index.toString()).toEqual(
          '[{"left": 0, "right": 1.5},{"left": 1.5, "right": 3},{"left": 0, "right": 1.5},{"left": 1.5, "right": 3}]'
        )
        expect(qq.columns).toEqual([["(0.0, 1.5]", "(1.5, 3.0]"]])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: "object",
              numpy_type: "interval[float64, right]",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("interval int64", () => {
        const mockElement = { data: INTERVAL_INT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index.toString()).toEqual(
          '[{"left": 0, "right": 1},{"left": 1, "right": 2},{"left": 0, "right": 1},{"left": 1, "right": 2}]'
        )
        expect(qq.columns).toEqual([["(0, 1]", "(1, 2]"]])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: "object",
              numpy_type: "interval[int64, right]",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("interval uint64", () => {
        const mockElement = { data: INTERVAL_UINT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index.toString()).toEqual(
          '[{"left": 0, "right": 1},{"left": 1, "right": 2},{"left": 0, "right": 1},{"left": 1, "right": 2}]'
        )
        expect(qq.columns).toEqual([["(0, 1]", "(1, 2]"]])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
          ["foo", BigInt(100)],
          ["bar", BigInt(200)],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: "object",
              numpy_type: "interval[uint64, right]",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("range", () => {
        const mockElement = { data: RANGE }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index).toEqual([[0, 1, 2, 3]])
        expect(qq.columns).toEqual([["0", "1"]])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.RangeIndex,
              numpy_type: IndexTypeName.RangeIndex,
              meta: {
                start: 0,
                step: 1,
                stop: 4,
                kind: "range",
                name: null,
              },
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
          ],
        })
      })

      test("uint64", () => {
        const mockElement = { data: UINT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index).toEqual([
          vectorFromArray([BigInt(1), BigInt(2), BigInt(1), BigInt(2)]),
        ])
        expect(qq.columns).toEqual([["1", "2"]])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          [BigInt(1), BigInt(2)],
          [BigInt(3), BigInt(4)],
          [BigInt(1), BigInt(2)],
          [BigInt(3), BigInt(4)],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.UInt64Index,
              numpy_type: IndexTypeName.UInt64Index,
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
            {
              pandas_type: "int64",
              numpy_type: "int64",
              meta: null,
            },
          ],
        })
      })

      test("unicode", () => {
        const mockElement = { data: UNICODE }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index).toEqual([vectorFromArray(["i1", "i2", "i1", "i2"])])
        expect(qq.columns).toEqual([["c1", "c2"]])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.UnicodeIndex,
              numpy_type: "object",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
          ],
        })
      })
    })

    describe("Special cases", () => {
      it("does not mutate the original element", () => {
        const mockElement = { data: UNICODE }
        const q = new Quiver(mockElement)
        const qClone = cloneDeep(q)

        q.addRows(q)
        expect(q).toEqual(qClone)
      })

      test("multi-index", () => {
        const mockElement = { data: MULTI }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        expect(qq.index).toEqual([
          vectorFromArray([BigInt(1), BigInt(2), BigInt(1), BigInt(2)]),
          vectorFromArray(["red", "blue", "red", "blue"]),
        ])
        expect(qq.columns).toEqual([
          ["1", "2"],
          ["red", "blue"],
        ])
        expect(qq.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(qq.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.Int64Index,
              numpy_type: IndexTypeName.Int64Index,
              meta: null,
            },
            {
              pandas_type: IndexTypeName.UnicodeIndex,
              numpy_type: "object",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
          ],
        })
      })

      test("DataFrames with different column types", () => {
        const mockElement1 = { data: UNICODE }
        const mockElement2 = { data: DIFFERENT_COLUMN_TYPES }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        const q1q2 = q1.addRows(q2)

        expect(q1q2.index).toEqual([vectorFromArray(["i1", "i2", "i1", "i2"])])
        expect(q1q2.columns).toEqual([["c1", "c2"]])
        expect(q1q2.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
          ["baz", "1"],
          ["qux", "2"],
        ])
        expect(q1q2.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.UnicodeIndex,
              numpy_type: "object",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
          ],
        })
      })

      it("shows df2 if df1 is empty", () => {
        const mockElement1 = { data: EMPTY }
        const mockElement2 = { data: UNICODE }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        const q1q2 = q1.addRows(q2)
        expect(q1q2).toEqual(q2)
      })

      it("shows df1 if df2 is empty", () => {
        const mockElement1 = { data: EMPTY }
        const mockElement2 = { data: UNICODE }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        const q2q1 = q2.addRows(q1)
        expect(q2q1).toEqual(q2)
      })

      it("shows an empty DataFrame if both df1 and df2 are empty", () => {
        const mockElement = { data: EMPTY }
        const q1 = new Quiver(mockElement)
        const q2 = new Quiver(mockElement)

        const q1q2 = q1.addRows(q2)
        expect(q1q2.isEmpty()).toBe(true)
      })

      it("uses df1 columns if df2 has more columns than df1", () => {
        const mockElement1 = { data: FEWER_COLUMNS }
        const mockElement2 = { data: UNICODE }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        const q1q2 = q1.addRows(q2)

        expect(q1q2.index).toEqual([vectorFromArray(["i1", "i2", "i1", "i2"])])
        expect(q1q2.columns).toEqual([["c1"]])
        expect(q1q2.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo"],
          ["bar"],
          ["foo"],
          ["bar"],
        ])
        expect(q1q2.types).toEqual({
          index: [
            {
              pandas_type: IndexTypeName.UnicodeIndex,
              numpy_type: "object",
              meta: null,
            },
          ],
          data: [
            {
              pandas_type: "unicode",
              numpy_type: "object",
              meta: null,
            },
          ],
        })
      })

      it("throws an error if df1 has more columns than df2", () => {
        const mockElement1 = { data: UNICODE }
        const mockElement2 = { data: FEWER_COLUMNS }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        expect(() => q1.addRows(q2)).toThrowErrorMatchingSnapshot()
      })

      it("throws an error if one of the DataFrames has Styler", () => {
        const mockElement1 = {
          data: STYLER,
          styler: {
            uuid: "FAKE_UUID",
            styles: "FAKE_CSS",
            caption: "FAKE_CAPTION",
            displayValues: DISPLAY_VALUES,
          },
        }
        const mockElement2 = { data: UNICODE }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        expect(() => q1.addRows(q2)).toThrowErrorMatchingSnapshot()
        expect(() => q2.addRows(q1)).toThrowErrorMatchingSnapshot()
      })

      it("throws an error if DataFrames have different index types", () => {
        const mockElement1 = { data: UNICODE }
        const mockElement2 = { data: RANGE }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        expect(() => q1.addRows(q2)).toThrowErrorMatchingSnapshot()
      })

      it("throws an error if DataFrames have different data types", () => {
        const mockElement1 = { data: UNICODE }
        const mockElement2 = { data: INT64 }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        expect(() => q1.addRows(q2)).toThrowErrorMatchingSnapshot()
      })
    })
  })
})
