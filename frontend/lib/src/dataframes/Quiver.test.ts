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

import { Field } from "apache-arrow"
import cloneDeep from "lodash/cloneDeep"

import { Quiver } from "~lib/dataframes/Quiver"
import {
  CATEGORICAL,
  DATE,
  DIFFERENT_COLUMN_TYPES,
  DISPLAY_VALUES,
  EMPTY,
  FEWER_COLUMNS,
  FLOAT64,
  INT64,
  INTERVAL_DATETIME64,
  INTERVAL_FLOAT64,
  INTERVAL_INT64,
  INTERVAL_UINT64,
  MULTI,
  NAMED_INDEX,
  RANGE,
  STYLER,
  UINT64,
  UNICODE,
} from "~lib/mocks/arrow"

import { DataFrameCellType } from "./arrowTypeUtils"

describe("Quiver", () => {
  describe("Public methods", () => {
    describe("Without Styler", () => {
      const mockElement = { data: UNICODE }
      const q = new Quiver(mockElement)

      test("cssId", () => {
        expect(q.styler?.cssId).toBeUndefined()
      })

      test("cssStyles", () => {
        expect(q.styler?.cssStyles).toBeUndefined()
      })

      test("caption", () => {
        expect(q.styler?.caption).toBeUndefined()
      })

      test("dimensions", () => {
        expect(q.dimensions).toStrictEqual({
          numHeaderRows: 1,
          numIndexColumns: 1,
          numDataRows: 2,
          numDataColumns: 2,
          numRows: 3,
          numColumns: 3,
        })
      })

      test("indexNames", () => {
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

      test("cssId", () => {
        expect(q.styler?.cssId).toEqual("T_FAKE_UUID")
      })

      test("cssStyles", () => {
        expect(q.styler?.cssStyles).toEqual("FAKE_CSS")
      })

      test("caption", () => {
        expect(q.styler?.caption).toEqual("FAKE_CAPTION")
      })

      test("dimensions", () => {
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

      test("index cell", () => {
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

      test("data cell", () => {
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
      test("categorical", () => {
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

      test("date", () => {
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

      test("float64", () => {
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

      test("int64", () => {
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

      test("interval datetime64[ns]", () => {
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

      test("interval float64", () => {
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

      test("interval int64", () => {
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

      test("interval uint64", () => {
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

      test("range", () => {
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

      test("uint64", () => {
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

      test("unicode", () => {
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
      test("empty", () => {
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

      test("multi-index", () => {
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

  describe("Add rows", () => {
    describe("Pandas index types", () => {
      test("categorical", () => {
        const mockElement = { data: CATEGORICAL }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        // Check index cells
        expect(qq.getCell(0, 0).content).toEqual("i1")
        expect(qq.getCell(1, 0).content).toEqual("i2")
        expect(qq.getCell(2, 0).content).toEqual("i1")
        expect(qq.getCell(3, 0).content).toEqual("i2")

        // Check data cells
        expect(qq.getCell(0, 1).content).toEqual("foo")
        expect(qq.getCell(0, 2).content).toEqual(BigInt(100))
        expect(qq.getCell(1, 1).content).toEqual("bar")
        expect(qq.getCell(1, 2).content).toEqual(BigInt(200))
        expect(qq.getCell(2, 1).content).toEqual("foo")
        expect(qq.getCell(2, 2).content).toEqual(BigInt(100))
        expect(qq.getCell(3, 1).content).toEqual("bar")
        expect(qq.getCell(3, 2).content).toEqual(BigInt(200))

        expect(qq.columnNames).toEqual([["", "c1", "c2"]])
        expect(qq.columnTypes).toEqual([
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

      test("date", () => {
        const mockElement = { data: DATE }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        // Check index cells
        expect(qq.getCell(0, 0).content).toEqual(978220800000)
        expect(qq.getCell(1, 0).content).toEqual(1009756800000)
        expect(qq.getCell(2, 0).content).toEqual(978220800000)
        expect(qq.getCell(3, 0).content).toEqual(1009756800000)

        // Check data cells
        expect(qq.getCell(0, 1).content).toEqual(
          new Date("2020-01-02T00:00:00.000Z").getTime()
        )
        expect(qq.getCell(0, 2).content).toEqual(
          new Date("2020-10-20T00:00:00.000Z").getTime()
        )
        expect(qq.getCell(1, 1).content).toEqual(
          new Date("2020-01-02T00:00:00.000Z").getTime()
        )
        expect(qq.getCell(1, 2).content).toEqual(
          new Date("2020-10-20T00:00:00.000Z").getTime()
        )
        expect(qq.getCell(2, 1).content).toEqual(
          new Date("2020-01-02T00:00:00.000Z").getTime()
        )
        expect(qq.getCell(2, 2).content).toEqual(
          new Date("2020-10-20T00:00:00.000Z").getTime()
        )
        expect(qq.getCell(3, 1).content).toEqual(
          new Date("2020-01-02T00:00:00.000Z").getTime()
        )
        expect(qq.getCell(3, 2).content).toEqual(
          new Date("2020-10-20T00:00:00.000Z").getTime()
        )

        expect(qq.columnNames).toEqual([
          ["", "2000-12-31 00:00:00", "2001-12-31 00:00:00"],
        ])
        expect(qq.columnTypes).toEqual([
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

      test("float64", () => {
        const mockElement = { data: FLOAT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        // Check index cells
        expect(qq.getCell(0, 0).content).toEqual(1.24)
        expect(qq.getCell(1, 0).content).toEqual(2.35)
        expect(qq.getCell(2, 0).content).toEqual(1.24)
        expect(qq.getCell(3, 0).content).toEqual(2.35)

        // Check data cells
        expect(qq.getCell(0, 1).content).toEqual(1.2)
        expect(qq.getCell(0, 2).content).toEqual(1.3)
        expect(qq.getCell(1, 1).content).toEqual(1.4)
        expect(qq.getCell(1, 2).content).toEqual(1.5)
        expect(qq.getCell(2, 1).content).toEqual(1.2)
        expect(qq.getCell(2, 2).content).toEqual(1.3)
        expect(qq.getCell(3, 1).content).toEqual(1.4)
        expect(qq.getCell(3, 2).content).toEqual(1.5)

        expect(qq.columnNames).toEqual([["", "1.24", "2.35"]])
        expect(qq.columnTypes).toEqual([
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

      test("int64", () => {
        const mockElement = { data: INT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        // Check index cells
        expect(qq.getCell(0, 0).content).toEqual(BigInt(1))
        expect(qq.getCell(1, 0).content).toEqual(BigInt(2))
        expect(qq.getCell(2, 0).content).toEqual(BigInt(1))
        expect(qq.getCell(3, 0).content).toEqual(BigInt(2))

        // Check data cells
        expect(qq.getCell(0, 1).content).toEqual(BigInt(0))
        expect(qq.getCell(0, 2).content).toEqual(BigInt(1))
        expect(qq.getCell(1, 1).content).toEqual(BigInt(2))
        expect(qq.getCell(1, 2).content).toEqual(BigInt(3))
        expect(qq.getCell(2, 1).content).toEqual(BigInt(0))
        expect(qq.getCell(2, 2).content).toEqual(BigInt(1))
        expect(qq.getCell(3, 1).content).toEqual(BigInt(2))
        expect(qq.getCell(3, 2).content).toEqual(BigInt(3))

        expect(qq.columnNames).toEqual([["", "1", "2"]])
        expect(qq.columnTypes).toEqual([
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

      test("interval datetime64[ns]", () => {
        const mockElement = { data: INTERVAL_DATETIME64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        // Check index cells

        expect(qq.getCell(0, 0).content?.toString()).toEqual(
          '{"left": 1483228800000, "right": 1483315200000}'
        )
        expect(qq.getCell(1, 0).content?.toString()).toEqual(
          '{"left": 1483315200000, "right": 1483401600000}'
        )
        expect(qq.getCell(2, 0).content?.toString()).toEqual(
          '{"left": 1483228800000, "right": 1483315200000}'
        )
        expect(qq.getCell(3, 0).content?.toString()).toEqual(
          '{"left": 1483315200000, "right": 1483401600000}'
        )

        // Check data cells
        expect(qq.getCell(0, 1).content).toEqual("foo")
        expect(qq.getCell(0, 2).content).toEqual(BigInt(100))
        expect(qq.getCell(1, 1).content).toEqual("bar")
        expect(qq.getCell(1, 2).content).toEqual(BigInt(200))
        expect(qq.getCell(2, 1).content).toEqual("foo")
        expect(qq.getCell(2, 2).content).toEqual(BigInt(100))
        expect(qq.getCell(3, 1).content).toEqual("bar")
        expect(qq.getCell(3, 2).content).toEqual(BigInt(200))

        expect(qq.columnNames).toEqual([
          ["", "(2017-01-01, 2017-01-02]", "(2017-01-02, 2017-01-03]"],
        ])
        expect(qq.columnTypes).toEqual([
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

      test("interval float64", () => {
        const mockElement = { data: INTERVAL_FLOAT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        // Check index cells
        expect(qq.getCell(0, 0).content?.toString()).toEqual(
          '{"left": 0, "right": 1.5}'
        )
        expect(qq.getCell(1, 0).content?.toString()).toEqual(
          '{"left": 1.5, "right": 3}'
        )
        expect(qq.getCell(2, 0).content?.toString()).toEqual(
          '{"left": 0, "right": 1.5}'
        )
        expect(qq.getCell(3, 0).content?.toString()).toEqual(
          '{"left": 1.5, "right": 3}'
        )

        // Check data cells
        expect(qq.getCell(0, 1).content).toEqual("foo")
        expect(qq.getCell(0, 2).content).toEqual(BigInt(100))
        expect(qq.getCell(1, 1).content).toEqual("bar")
        expect(qq.getCell(1, 2).content).toEqual(BigInt(200))
        expect(qq.getCell(2, 1).content).toEqual("foo")
        expect(qq.getCell(2, 2).content).toEqual(BigInt(100))
        expect(qq.getCell(3, 1).content).toEqual("bar")
        expect(qq.getCell(3, 2).content).toEqual(BigInt(200))

        expect(qq.columnNames).toEqual([["", "(0.0, 1.5]", "(1.5, 3.0]"]])
        expect(qq.columnTypes).toEqual([
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

      test("interval int64", () => {
        const mockElement = { data: INTERVAL_INT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        // Check index cells
        expect(qq.getCell(0, 0).content?.toString()).toEqual(
          '{"left": 0, "right": 1}'
        )
        expect(qq.getCell(1, 0).content?.toString()).toEqual(
          '{"left": 1, "right": 2}'
        )
        expect(qq.getCell(2, 0).content?.toString()).toEqual(
          '{"left": 0, "right": 1}'
        )
        expect(qq.getCell(3, 0).content?.toString()).toEqual(
          '{"left": 1, "right": 2}'
        )

        // Check data cells
        expect(qq.getCell(0, 1).content).toEqual("foo")
        expect(qq.getCell(1, 1).content).toEqual("bar")
        expect(qq.getCell(2, 1).content).toEqual("foo")
        expect(qq.getCell(3, 1).content).toEqual("bar")

        expect(qq.columnNames).toEqual([["", "(0, 1]", "(1, 2]"]])
        expect(qq.columnTypes).toEqual([
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

      test("interval uint64", () => {
        const mockElement = { data: INTERVAL_UINT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        // Check index cells
        expect(qq.getCell(0, 0).content?.toString()).toEqual(
          '{"left": 0, "right": 1}'
        )
        expect(qq.getCell(1, 0).content?.toString()).toEqual(
          '{"left": 1, "right": 2}'
        )
        expect(qq.getCell(2, 0).content?.toString()).toEqual(
          '{"left": 0, "right": 1}'
        )
        expect(qq.getCell(3, 0).content?.toString()).toEqual(
          '{"left": 1, "right": 2}'
        )

        // Check data cells
        expect(qq.getCell(0, 1).content).toEqual("foo")
        expect(qq.getCell(0, 2).content).toEqual(BigInt(100))
        expect(qq.getCell(1, 1).content).toEqual("bar")
        expect(qq.getCell(1, 2).content).toEqual(BigInt(200))
        expect(qq.getCell(2, 1).content).toEqual("foo")
        expect(qq.getCell(2, 2).content).toEqual(BigInt(100))
        expect(qq.getCell(3, 1).content).toEqual("bar")
        expect(qq.getCell(3, 2).content).toEqual(BigInt(200))

        expect(qq.columnNames).toEqual([["", "(0, 1]", "(1, 2]"]])
        expect(qq.columnTypes).toEqual([
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

      test("range", () => {
        const mockElement = { data: RANGE }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        // Check index cells
        expect(qq.getCell(0, 0).content).toEqual(0)
        expect(qq.getCell(1, 0).content).toEqual(1)
        expect(qq.getCell(2, 0).content).toEqual(2)
        expect(qq.getCell(3, 0).content).toEqual(3)

        // Check data cells
        expect(qq.getCell(0, 1).content).toEqual("foo")
        expect(qq.getCell(0, 2).content).toEqual("1")
        expect(qq.getCell(1, 1).content).toEqual("bar")
        expect(qq.getCell(1, 2).content).toEqual("2")
        expect(qq.getCell(2, 1).content).toEqual("foo")
        expect(qq.getCell(2, 2).content).toEqual("1")
        expect(qq.getCell(3, 1).content).toEqual("bar")
        expect(qq.getCell(3, 2).content).toEqual("2")

        expect(qq.columnNames).toEqual([["", "0", "1"]])
        expect(qq.columnTypes).toEqual([
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
                stop: 4,
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

      test("uint64", () => {
        const mockElement = { data: UINT64 }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        // Check index cells
        expect(qq.getCell(0, 0).content).toEqual(BigInt(1))
        expect(qq.getCell(1, 0).content).toEqual(BigInt(2))
        expect(qq.getCell(2, 0).content).toEqual(BigInt(1))
        expect(qq.getCell(3, 0).content).toEqual(BigInt(2))

        // Check data cells
        expect(qq.getCell(0, 1).content).toEqual(BigInt(1))
        expect(qq.getCell(0, 2).content).toEqual(BigInt(2))
        expect(qq.getCell(1, 1).content).toEqual(BigInt(3))
        expect(qq.getCell(1, 2).content).toEqual(BigInt(4))
        expect(qq.getCell(2, 1).content).toEqual(BigInt(1))
        expect(qq.getCell(2, 2).content).toEqual(BigInt(2))
        expect(qq.getCell(3, 1).content).toEqual(BigInt(3))
        expect(qq.getCell(3, 2).content).toEqual(BigInt(4))

        expect(qq.columnNames).toEqual([["", "1", "2"]])
        expect(qq.columnTypes).toEqual([
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

      test("unicode", () => {
        const mockElement = { data: UNICODE }
        const q = new Quiver(mockElement)

        const qq = q.addRows(q)

        // Check index cells
        expect(qq.getCell(0, 0).content).toEqual("i1")
        expect(qq.getCell(1, 0).content).toEqual("i2")
        expect(qq.getCell(2, 0).content).toEqual("i1")
        expect(qq.getCell(3, 0).content).toEqual("i2")

        // Check data cells
        expect(qq.getCell(0, 1).content).toEqual("foo")
        expect(qq.getCell(0, 2).content).toEqual("1")
        expect(qq.getCell(1, 1).content).toEqual("bar")
        expect(qq.getCell(1, 2).content).toEqual("2")
        expect(qq.getCell(2, 1).content).toEqual("foo")
        expect(qq.getCell(2, 2).content).toEqual("1")
        expect(qq.getCell(3, 1).content).toEqual("bar")
        expect(qq.getCell(3, 2).content).toEqual("2")

        expect(qq.columnNames).toEqual([["", "c1", "c2"]])
        expect(qq.columnTypes).toEqual([
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

        expect(qq.getCell(0, 0).content).toEqual(BigInt(1))
        expect(qq.getCell(1, 0).content).toEqual(BigInt(2))
        expect(qq.getCell(0, 1).content).toEqual("red")
        expect(qq.getCell(1, 1).content).toEqual("blue")

        // Check data cells
        expect(qq.getCell(0, 2).content).toEqual("foo")
        expect(qq.getCell(0, 3).content).toEqual("1")
        expect(qq.getCell(1, 2).content).toEqual("bar")
        expect(qq.getCell(1, 3).content).toEqual("2")

        expect(qq.columnNames).toEqual([
          ["", "", "1", "2"],
          ["number", "color", "red", "blue"],
        ])
        expect(qq.columnTypes).toEqual([
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

      test("DataFrames with different column types", () => {
        const mockElement1 = { data: UNICODE }
        const mockElement2 = { data: DIFFERENT_COLUMN_TYPES }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        const q1q2 = q1.addRows(q2)

        // Check index cells
        expect(q1q2.getCell(0, 0).content).toEqual("i1")
        expect(q1q2.getCell(1, 0).content).toEqual("i2")
        expect(q1q2.getCell(2, 0).content).toEqual("i1")
        expect(q1q2.getCell(3, 0).content).toEqual("i2")

        // Check data cells
        expect(q1q2.getCell(0, 1).content).toEqual("foo")
        expect(q1q2.getCell(0, 2).content).toEqual("1")
        expect(q1q2.getCell(1, 1).content).toEqual("bar")
        expect(q1q2.getCell(1, 2).content).toEqual("2")
        expect(q1q2.getCell(2, 1).content).toEqual("baz")
        expect(q1q2.getCell(2, 2).content).toEqual("1")
        expect(q1q2.getCell(3, 1).content).toEqual("qux")
        expect(q1q2.getCell(3, 2).content).toEqual("2")

        expect(q1q2.columnNames).toEqual([["", "c1", "c2"]])
        expect(q1q2.columnTypes).toEqual([
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
        expect(q1q2.dimensions.numDataRows).toBe(0)
      })

      it("uses df1 columns if df2 has more columns than df1", () => {
        const mockElement1 = { data: FEWER_COLUMNS }
        const mockElement2 = { data: UNICODE }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        const q1q2 = q1.addRows(q2)

        // Check index cells
        expect(q1q2.getCell(0, 0).content).toEqual("i1")
        expect(q1q2.getCell(1, 0).content).toEqual("i2")
        expect(q1q2.getCell(2, 0).content).toEqual("i1")
        expect(q1q2.getCell(3, 0).content).toEqual("i2")

        // Check data cells
        expect(q1q2.getCell(0, 1).content).toEqual("foo")
        expect(q1q2.getCell(1, 1).content).toEqual("bar")
        expect(q1q2.getCell(2, 1).content).toEqual("foo")
        expect(q1q2.getCell(3, 1).content).toEqual("bar")

        expect(q1q2.columnNames).toEqual([["", "c1"]])
        expect(q1q2.columnTypes).toEqual([
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
        ])
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

      it("throws an error if df1 has more columns than df2", () => {
        const mockElement1 = { data: UNICODE }
        const mockElement2 = { data: FEWER_COLUMNS }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        expect(() => q1.addRows(q2)).toThrowErrorMatchingSnapshot()
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
