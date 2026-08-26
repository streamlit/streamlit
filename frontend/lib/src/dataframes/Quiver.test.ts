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

import { Field } from "apache-arrow"

import { Quiver } from "~lib/dataframes/Quiver"
import { EMPTY } from "~lib/mocks/arrow/empty"
import { MULTI } from "~lib/mocks/arrow/multi"
import { NAMED_INDEX } from "~lib/mocks/arrow/namedIndex"
import { DISPLAY_VALUES, STYLER } from "~lib/mocks/arrow/styler"
import { CATEGORICAL } from "~lib/mocks/arrow/types/categorical"
import { DATE } from "~lib/mocks/arrow/types/datetime"
import { FLOAT64 } from "~lib/mocks/arrow/types/float64"
import { INT64 } from "~lib/mocks/arrow/types/int64"
import { INTERVAL_DATETIME64 } from "~lib/mocks/arrow/types/intervalDatetime64"
import { INTERVAL_FLOAT64 } from "~lib/mocks/arrow/types/intervalFloat64"
import { INTERVAL_INT64 } from "~lib/mocks/arrow/types/intervalInt64"
import { INTERVAL_UINT64 } from "~lib/mocks/arrow/types/intervalUint64"
import { RANGE } from "~lib/mocks/arrow/types/range"
import { UINT64 } from "~lib/mocks/arrow/types/uint64"
import { UNICODE } from "~lib/mocks/arrow/types/unicode"

import { DataFrameCellType } from "./arrowTypeUtils"

describe("Quiver", () => {
  describe("Public methods", () => {
    describe("Without Styler", () => {
      const mockElement = { data: UNICODE }
      const q = new Quiver(mockElement)

      it("cssId", () => {
        expect(q.styler?.cssId).toBeUndefined()
      })

      it("cssStyles", () => {
        expect(q.styler?.cssStyles).toBeUndefined()
      })

      it("caption", () => {
        expect(q.styler?.caption).toBeUndefined()
      })

      it("dimensions", () => {
        expect(q.dimensions).toStrictEqual({
          numHeaderRows: 1,
          numIndexColumns: 1,
          numDataRows: 2,
          numDataColumns: 2,
          numRows: 3,
          numColumns: 3,
        })
      })

      it("indexNames", () => {
        const currMockElement = { data: NAMED_INDEX }
        const currQ = new Quiver(currMockElement)
        expect(currQ.columnTypes[0]).toStrictEqual({
          type: DataFrameCellType.INDEX,
          arrowField: expect.any(Field),
          pandasType: {
            field_name: "INDEX",
            name: "INDEX",
            numpy_type: "range",
            pandas_type: "range",
            metadata: {
              kind: "range",
              name: "INDEX",
              start: 0,
              step: 1,
              stop: 2,
            },
          },
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

      it("cssId", () => {
        expect(q.styler?.cssId).toEqual("T_FAKE_UUID")
      })

      it("cssStyles", () => {
        expect(q.styler?.cssStyles).toEqual("FAKE_CSS")
      })

      it("caption", () => {
        expect(q.styler?.caption).toEqual("FAKE_CAPTION")
      })

      it("dimensions", () => {
        expect(q.dimensions).toStrictEqual({
          numHeaderRows: 1,
          numIndexColumns: 1,
          numDataRows: 2,
          numDataColumns: 2,
          numRows: 3,
          numColumns: 3,
        })
      })
    })

    describe("getCell", () => {
      const mockElement = { data: UNICODE }
      const q = new Quiver(mockElement)

      it("index cell", () => {
        expect(q.getCell(0, 0)).toStrictEqual({
          type: "index",
          content: "i1",
          contentType: {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          field: expect.any(Field),
        })
      })

      it("data cell", () => {
        expect(q.getCell(0, 2)).toStrictEqual({
          type: "data",
          content: "1",
          contentType: {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "c2",
              name: "c2",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          field: expect.any(Field),
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
  })

  describe("Display", () => {
    describe("Pandas index types", () => {
      it("categorical", () => {
        const mockElement = { data: CATEGORICAL }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content).toEqual("i1")
        expect(q.getCell(1, 0).content).toEqual("i2")

        // Check data cells
        expect(q.getCell(0, 1).content).toEqual("foo")
        expect(q.getCell(0, 2).content).toEqual(BigInt(100))
        expect(q.getCell(1, 1).content).toEqual("bar")
        expect(q.getCell(1, 2).content).toEqual(BigInt(200))

        expect(q.columnNames).toEqual([["", "c1", "c2"]])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "categorical",
              numpy_type: "int8",
              metadata: {
                num_categories: 3,
                ordered: false,
              },
            },
            categoricalOptions: ["i1", "i2", "i3"],
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "c1",
              name: "c1",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "c2",
              name: "c2",
              pandas_type: "int64",
              numpy_type: "int64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })

      it("date", () => {
        const mockElement = { data: DATE }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content).toEqual(978220800000)
        expect(q.getCell(1, 0).content).toEqual(1009756800000)

        // Check data cells
        expect(q.getCell(0, 1).content).toEqual(
          new Date("2020-01-02T00:00:00.000Z").getTime()
        )
        expect(q.getCell(0, 2).content).toEqual(
          new Date("2020-10-20T00:00:00.000Z").getTime()
        )
        expect(q.getCell(1, 1).content).toEqual(
          new Date("2020-01-02T00:00:00.000Z").getTime()
        )
        expect(q.getCell(1, 2).content).toEqual(
          new Date("2020-10-20T00:00:00.000Z").getTime()
        )

        expect(q.columnNames).toEqual([
          ["", "2000-12-31 00:00:00", "2001-12-31 00:00:00"],
        ])

        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "datetime",
              numpy_type: "datetime64[ns]",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "2000-12-31 00:00:00",
              name: "2000-12-31 00:00:00",
              pandas_type: "date",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "2001-12-31 00:00:00",
              name: "2001-12-31 00:00:00",
              pandas_type: "date",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })

      it("float64", () => {
        const mockElement = { data: FLOAT64 }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content).toEqual(1.24)
        expect(q.getCell(1, 0).content).toEqual(2.35)

        // Check data cells
        expect(q.getCell(0, 1).content).toEqual(1.2)
        expect(q.getCell(0, 2).content).toEqual(1.3)
        expect(q.getCell(1, 1).content).toEqual(1.4)
        expect(q.getCell(1, 2).content).toEqual(1.5)

        expect(q.columnNames).toEqual([["", "1.24", "2.35"]])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "float64",
              numpy_type: "float64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "1.24",
              name: "1.24",
              pandas_type: "float64",
              numpy_type: "float64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "2.35",
              name: "2.35",
              pandas_type: "float64",
              numpy_type: "float64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })

      it("int64", () => {
        const mockElement = { data: INT64 }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content).toEqual(BigInt(1))
        expect(q.getCell(1, 0).content).toEqual(BigInt(2))

        // Check data cells
        expect(q.getCell(0, 1).content).toEqual(BigInt(0))
        expect(q.getCell(0, 2).content).toEqual(BigInt(1))
        expect(q.getCell(1, 1).content).toEqual(BigInt(2))
        expect(q.getCell(1, 2).content).toEqual(BigInt(3))

        expect(q.columnNames).toEqual([["", "1", "2"]])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "int64",
              numpy_type: "int64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "1",
              name: "1",
              pandas_type: "int64",
              numpy_type: "int64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "2",
              name: "2",
              pandas_type: "int64",
              numpy_type: "int64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })

      it("interval datetime64[ns]", () => {
        const mockElement = { data: INTERVAL_DATETIME64 }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content?.toString()).toEqual(
          '{"left": 1483228800000, "right": 1483315200000}'
        )
        expect(q.getCell(1, 0).content?.toString()).toEqual(
          '{"left": 1483315200000, "right": 1483401600000}'
        )

        // Check data cells
        expect(q.getCell(0, 1).content).toEqual("foo")
        expect(q.getCell(0, 2).content).toEqual(BigInt(100))
        expect(q.getCell(1, 1).content).toEqual("bar")
        expect(q.getCell(1, 2).content).toEqual(BigInt(200))

        expect(q.columnNames).toEqual([
          ["", "(2017-01-01, 2017-01-02]", "(2017-01-02, 2017-01-03]"],
        ])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "object",
              numpy_type: "interval[datetime64[ns], right]",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "(2017-01-01, 2017-01-02]",
              name: "(2017-01-01, 2017-01-02]",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "(2017-01-02, 2017-01-03]",
              name: "(2017-01-02, 2017-01-03]",
              pandas_type: "int64",
              numpy_type: "int64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })

      it("interval float64", () => {
        const mockElement = { data: INTERVAL_FLOAT64 }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content?.toString()).toEqual(
          '{"left": 0, "right": 1.5}'
        )
        expect(q.getCell(1, 0).content?.toString()).toEqual(
          '{"left": 1.5, "right": 3}'
        )

        // Check data cells
        expect(q.getCell(0, 1).content).toEqual("foo")
        expect(q.getCell(0, 2).content).toEqual(BigInt(100))
        expect(q.getCell(1, 1).content).toEqual("bar")
        expect(q.getCell(1, 2).content).toEqual(BigInt(200))

        expect(q.columnNames).toEqual([["", "(0.0, 1.5]", "(1.5, 3.0]"]])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "object",
              numpy_type: "interval[float64, right]",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "(0.0, 1.5]",
              name: "(0.0, 1.5]",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "(1.5, 3.0]",
              name: "(1.5, 3.0]",
              pandas_type: "int64",
              numpy_type: "int64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })

      it("interval int64", () => {
        const mockElement = { data: INTERVAL_INT64 }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content?.toString()).toEqual(
          '{"left": 0, "right": 1}'
        )
        expect(q.getCell(1, 0).content?.toString()).toEqual(
          '{"left": 1, "right": 2}'
        )

        // Check data cells
        expect(q.getCell(0, 1).content).toEqual("foo")
        expect(q.getCell(0, 2).content).toEqual(BigInt(100))
        expect(q.getCell(1, 1).content).toEqual("bar")
        expect(q.getCell(1, 2).content).toEqual(BigInt(200))

        expect(q.columnNames).toEqual([["", "(0, 1]", "(1, 2]"]])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "object",
              numpy_type: "interval[int64, right]",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "(0, 1]",
              name: "(0, 1]",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "(1, 2]",
              name: "(1, 2]",
              pandas_type: "int64",
              numpy_type: "int64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })

      it("interval uint64", () => {
        const mockElement = { data: INTERVAL_UINT64 }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content?.toString()).toEqual(
          '{"left": 0, "right": 1}'
        )
        expect(q.getCell(1, 0).content?.toString()).toEqual(
          '{"left": 1, "right": 2}'
        )

        // Check data cells
        expect(q.getCell(0, 1).content).toEqual("foo")
        expect(q.getCell(0, 2).content).toEqual(BigInt(100))
        expect(q.getCell(1, 1).content).toEqual("bar")
        expect(q.getCell(1, 2).content).toEqual(BigInt(200))

        expect(q.columnNames).toEqual([["", "(0, 1]", "(1, 2]"]])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "object",
              numpy_type: "interval[uint64, right]",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "(0, 1]",
              name: "(0, 1]",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "(1, 2]",
              name: "(1, 2]",
              pandas_type: "int64",
              numpy_type: "int64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })

      it("range", () => {
        const mockElement = { data: RANGE }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content).toEqual(0)
        expect(q.getCell(1, 0).content).toEqual(1)

        // Check data cells
        expect(q.getCell(0, 1).content).toEqual("foo")
        expect(q.getCell(0, 2).content).toEqual("1")
        expect(q.getCell(1, 1).content).toEqual("bar")
        expect(q.getCell(1, 2).content).toEqual("2")

        expect(q.columnNames).toEqual([["", "0", "1"]])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "",
              name: "",
              pandas_type: "range",
              numpy_type: "range",
              metadata: {
                start: 0,
                step: 1,
                stop: 2,
                kind: "range",
                name: null,
              },
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "0",
              name: "0",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "1",
              name: "1",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })

      it("uint64", () => {
        const mockElement = { data: UINT64 }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content).toEqual(BigInt(1))
        expect(q.getCell(1, 0).content).toEqual(BigInt(2))

        // Check data cells
        expect(q.getCell(0, 1).content).toEqual(BigInt(1))
        expect(q.getCell(0, 2).content).toEqual(BigInt(2))
        expect(q.getCell(1, 1).content).toEqual(BigInt(3))
        expect(q.getCell(1, 2).content).toEqual(BigInt(4))

        expect(q.columnNames).toEqual([["", "1", "2"]])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "uint64",
              numpy_type: "uint64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "1",
              name: "1",
              pandas_type: "int64",
              numpy_type: "int64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "2",
              name: "2",
              pandas_type: "int64",
              numpy_type: "int64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })

      it("unicode", () => {
        const mockElement = { data: UNICODE }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content).toEqual("i1")
        expect(q.getCell(1, 0).content).toEqual("i2")

        // Check data cells
        expect(q.getCell(0, 1).content).toEqual("foo")
        expect(q.getCell(0, 2).content).toEqual("1")
        expect(q.getCell(1, 1).content).toEqual("bar")
        expect(q.getCell(1, 2).content).toEqual("2")

        expect(q.columnNames).toEqual([["", "c1", "c2"]])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "c1",
              name: "c1",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "c2",
              name: "c2",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })
    })

    describe("Special cases", () => {
      it("empty", () => {
        const mockElement = { data: EMPTY }
        const q = new Quiver(mockElement)

        expect(q.dimensions).toStrictEqual({
          numHeaderRows: 1,
          numIndexColumns: 1,
          numDataRows: 0,
          numDataColumns: 0,
          numRows: 1,
          numColumns: 1,
        })

        expect(q.columnNames).toEqual([[""]])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "__index_level_0__",
              name: null,
              pandas_type: "empty",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })

      it("multi-index", () => {
        const mockElement = { data: MULTI }
        const q = new Quiver(mockElement)

        // Check index cells
        expect(q.getCell(0, 0).content).toEqual(BigInt(1))
        expect(q.getCell(1, 0).content).toEqual(BigInt(2))
        expect(q.getCell(0, 1).content).toEqual("red")
        expect(q.getCell(1, 1).content).toEqual("blue")

        // Check data cells
        expect(q.getCell(0, 2).content).toEqual("foo")
        expect(q.getCell(0, 3).content).toEqual("1")
        expect(q.getCell(1, 2).content).toEqual("bar")
        expect(q.getCell(1, 3).content).toEqual("2")

        expect(q.columnNames).toEqual([
          ["", "", "1", "2"],
          ["number", "color", "red", "blue"],
        ])
        expect(q.columnTypes).toEqual([
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "number",
              name: "number",
              pandas_type: "int64",
              numpy_type: "int64",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.INDEX,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "color",
              name: "color",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "('1', 'red')",
              name: "('1', 'red')",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
          {
            type: DataFrameCellType.DATA,
            arrowField: expect.any(Field),
            pandasType: {
              field_name: "('2', 'blue')",
              name: "('2', 'blue')",
              pandas_type: "unicode",
              numpy_type: "object",
              metadata: null,
            },
            categoricalOptions: undefined,
          },
        ])
      })
    })
  })
})
