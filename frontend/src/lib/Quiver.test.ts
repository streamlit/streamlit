/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { util } from "apache-arrow"
import { Quiver } from "src/lib/Quiver"
import {
  // Types
  CATEGORICAL,
  DATETIME,
  FLOAT64,
  INT64,
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
          contentType: "unicode",
        })
      })

      test("columns cell", () => {
        expect(q.getCell(0, 1)).toStrictEqual({
          type: "columns",
          cssClass: "col_heading level0 col0",
          content: "c1",
        })
      })

      test("data cell", () => {
        expect(q.getCell(1, 1)).toStrictEqual({
          type: "data",
          cssClass: "data row0 col0",
          cssId: undefined,
          content: "foo",
          contentType: "unicode",
        })
      })

      it("throws an exception if row index is out of range", () => {
        expect(() => q.getCell(5, 0)).toThrow("Row index is out of range.")
      })

      it("throws an exception if column index is out of range", () => {
        expect(() => q.getCell(0, 5)).toThrow("Column index is out of range.")
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

        expect(q).toEqual({
          index: [["i1"], ["i2"]],
          columns: [["c1", "c2"]],
          data: [
            ["foo", util.BN.new(new Int32Array([100, 0]))],
            ["bar", util.BN.new(new Int32Array([200, 0]))],
          ],
          types: {
            index: [
              {
                name: "categorical",
                meta: {
                  num_categories: 3,
                  ordered: false,
                },
              },
            ],
            data: ["unicode", "int64"],
          },
        })
      })

      test("datetime", () => {
        const mockElement = { data: DATETIME }
        const q = new Quiver(mockElement)

        expect(q).toEqual({
          index: [[978220800000], [1009756800000]],
          columns: [["2000-12-31 00:00:00", "2001-12-31 00:00:00"]],
          data: [
            [
              new Date("2020-01-02T00:00:00.000Z"),
              new Date("2020-10-20T00:00:00.000Z"),
            ],
            [
              new Date("2020-01-02T00:00:00.000Z"),
              new Date("2020-10-20T00:00:00.000Z"),
            ],
          ],
          types: {
            index: [
              {
                name: "datetime",
                meta: null,
              },
            ],
            data: ["date", "date"],
          },
        })
      })

      test("float64", () => {
        const mockElement = { data: FLOAT64 }
        const q = new Quiver(mockElement)

        expect(q).toEqual({
          index: [[1.24], [2.35]],
          columns: [["1.24", "2.35"]],
          data: [
            [1.2, 1.3],
            [1.4, 1.5],
          ],
          types: {
            index: [
              {
                name: "float64",
                meta: null,
              },
            ],
            data: ["float64", "float64"],
          },
        })
      })

      test("int64", () => {
        const mockElement = { data: INT64 }
        const q = new Quiver(mockElement)

        expect(q).toEqual({
          index: [
            [util.BN.new(new Int32Array([1, 0]))],
            [util.BN.new(new Int32Array([2, 0]))],
          ],
          columns: [["1", "2"]],
          data: [
            [
              util.BN.new(new Int32Array([0, 0])),
              util.BN.new(new Int32Array([1, 0])),
            ],
            [
              util.BN.new(new Int32Array([2, 0])),
              util.BN.new(new Int32Array([3, 0])),
            ],
          ],
          types: {
            index: [
              {
                name: "int64",
                meta: null,
              },
            ],
            data: ["int64", "int64"],
          },
        })
      })

      test("range", () => {
        const mockElement = { data: RANGE }
        const q = new Quiver(mockElement)

        expect(q).toEqual({
          index: [[0], [1]],
          columns: [["0", "1"]],
          data: [
            ["foo", "1"],
            ["bar", "2"],
          ],
          types: {
            index: [
              {
                name: "range",
                meta: {
                  start: 0,
                  step: 1,
                  stop: 2,
                  kind: "range",
                  name: null,
                },
              },
            ],
            data: ["unicode", "unicode"],
          },
        })
      })

      test("uint64", () => {
        const mockElement = { data: UINT64 }
        const q = new Quiver(mockElement)

        expect(q).toEqual({
          index: [
            [util.BN.new(new Int32Array([1, 0]), false)],
            [util.BN.new(new Int32Array([2, 0]), false)],
          ],
          columns: [["1", "2"]],
          data: [
            [
              util.BN.new(new Int32Array([1, 0])),
              util.BN.new(new Int32Array([2, 0])),
            ],
            [
              util.BN.new(new Int32Array([3, 0])),
              util.BN.new(new Int32Array([4, 0])),
            ],
          ],
          types: {
            index: [
              {
                name: "uint64",
                meta: null,
              },
            ],
            data: ["int64", "int64"],
          },
        })
      })

      test("unicode", () => {
        const mockElement = { data: UNICODE }
        const q = new Quiver(mockElement)

        expect(q).toEqual({
          index: [["i1"], ["i2"]],
          columns: [["c1", "c2"]],
          data: [
            ["foo", "1"],
            ["bar", "2"],
          ],
          types: {
            index: [{ name: "unicode", meta: null }],
            data: ["unicode", "unicode"],
          },
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

        expect(q).toEqual({
          index: [],
          columns: [],
          data: [],
          types: {
            index: [{ name: "empty", meta: null }],
            data: [],
          },
        })
      })

      test("multi-index", () => {
        const mockElement = { data: MULTI }
        const q = new Quiver(mockElement)

        expect(q).toEqual({
          index: [
            [util.BN.new(new Int32Array([1, 0])), "red"],
            [util.BN.new(new Int32Array([2, 0])), "blue"],
          ],
          columns: [
            ["1", "2"],
            ["red", "blue"],
          ],
          data: [
            ["foo", "1"],
            ["bar", "2"],
          ],
          types: {
            index: [
              {
                name: "int64",
                meta: null,
              },
              {
                name: "unicode",
                meta: null,
              },
            ],
            data: ["unicode", "unicode"],
          },
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

        expect(q).toEqual({
          index: [[0], [1]],
          columns: [["0", "1"]],
          data: [
            [
              util.BN.new(new Int32Array([1, 0])),
              util.BN.new(new Int32Array([2, 0])),
            ],
            [
              util.BN.new(new Int32Array([3, 0])),
              util.BN.new(new Int32Array([4, 0])),
            ],
          ],
          types: {
            index: [
              {
                name: "range",
                meta: {
                  start: 0,
                  step: 1,
                  stop: 2,
                  kind: "range",
                  name: null,
                },
              },
            ],
            data: ["int64", "int64"],
          },
          styler: {
            uuid: "FAKE_UUID",
            styles: "FAKE_CSS",
            caption: "FAKE_CAPTION",
            displayValues: {
              index: [[0], [1]],
              columns: [["0", "1"]],
              data: [
                ["1", "2"],
                ["3", "4"],
              ],
              types: {
                index: [
                  {
                    meta: {
                      kind: "range",
                      name: null,
                      start: 0,
                      step: 1,
                      stop: 2,
                    },
                    name: "range",
                  },
                ],
                data: ["unicode", "unicode"],
              },
            },
          },
        })
      })
    })
  })

  describe("Add rows", () => {
    describe("Pandas index types", () => {
      test("categorical", () => {
        const mockElement = { data: CATEGORICAL }
        const q = new Quiver(mockElement)

        q.addRows(q)
        expect(q).toEqual({
          index: [["i1"], ["i2"], ["i1"], ["i2"]],
          columns: [["c1", "c2"]],
          data: [
            ["foo", util.BN.new(new Int32Array([100, 0]))],
            ["bar", util.BN.new(new Int32Array([200, 0]))],
            ["foo", util.BN.new(new Int32Array([100, 0]))],
            ["bar", util.BN.new(new Int32Array([200, 0]))],
          ],
          types: {
            index: [
              {
                name: "categorical",
                meta: {
                  num_categories: 3,
                  ordered: false,
                },
              },
            ],
            data: ["unicode", "int64"],
          },
        })
      })

      test("datetime", () => {
        const mockElement = { data: DATETIME }
        const q = new Quiver(mockElement)

        q.addRows(q)
        expect(q).toEqual({
          index: [
            [978220800000],
            [1009756800000],
            [978220800000],
            [1009756800000],
          ],
          columns: [["2000-12-31 00:00:00", "2001-12-31 00:00:00"]],
          data: [
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
          ],
          types: {
            index: [
              {
                name: "datetime",
                meta: null,
              },
            ],
            data: ["date", "date"],
          },
        })
      })

      test("float64", () => {
        const mockElement = { data: FLOAT64 }
        const q = new Quiver(mockElement)

        q.addRows(q)
        expect(q).toEqual({
          index: [[1.24], [2.35], [1.24], [2.35]],
          columns: [["1.24", "2.35"]],
          data: [
            [1.2, 1.3],
            [1.4, 1.5],
            [1.2, 1.3],
            [1.4, 1.5],
          ],
          types: {
            index: [
              {
                name: "float64",
                meta: null,
              },
            ],
            data: ["float64", "float64"],
          },
        })
      })

      test("int64", () => {
        const mockElement = { data: INT64 }
        const q = new Quiver(mockElement)

        q.addRows(q)
        expect(q).toEqual({
          index: [
            [util.BN.new(new Int32Array([1, 0]))],
            [util.BN.new(new Int32Array([2, 0]))],
            [util.BN.new(new Int32Array([1, 0]))],
            [util.BN.new(new Int32Array([2, 0]))],
          ],
          columns: [["1", "2"]],
          data: [
            [
              util.BN.new(new Int32Array([0, 0])),
              util.BN.new(new Int32Array([1, 0])),
            ],
            [
              util.BN.new(new Int32Array([2, 0])),
              util.BN.new(new Int32Array([3, 0])),
            ],
            [
              util.BN.new(new Int32Array([0, 0])),
              util.BN.new(new Int32Array([1, 0])),
            ],
            [
              util.BN.new(new Int32Array([2, 0])),
              util.BN.new(new Int32Array([3, 0])),
            ],
          ],
          types: {
            index: [
              {
                name: "int64",
                meta: null,
              },
            ],
            data: ["int64", "int64"],
          },
        })
      })

      test("range", () => {
        const mockElement = { data: RANGE }
        const q = new Quiver(mockElement)

        q.addRows(q)
        expect(q).toEqual({
          index: [[0], [1], [2], [3]],
          columns: [["0", "1"]],
          data: [
            ["foo", "1"],
            ["bar", "2"],
            ["foo", "1"],
            ["bar", "2"],
          ],
          types: {
            index: [
              {
                name: "range",
                meta: {
                  start: 0,
                  step: 1,
                  stop: 4,
                  kind: "range",
                  name: null,
                },
              },
            ],
            data: ["unicode", "unicode"],
          },
        })
      })

      test("uint64", () => {
        const mockElement = { data: UINT64 }
        const q = new Quiver(mockElement)

        q.addRows(q)
        expect(q).toEqual({
          index: [
            [util.BN.new(new Int32Array([1, 0]), false)],
            [util.BN.new(new Int32Array([2, 0]), false)],
            [util.BN.new(new Int32Array([1, 0]), false)],
            [util.BN.new(new Int32Array([2, 0]), false)],
          ],
          columns: [["1", "2"]],
          data: [
            [
              util.BN.new(new Int32Array([1, 0])),
              util.BN.new(new Int32Array([2, 0])),
            ],
            [
              util.BN.new(new Int32Array([3, 0])),
              util.BN.new(new Int32Array([4, 0])),
            ],
            [
              util.BN.new(new Int32Array([1, 0])),
              util.BN.new(new Int32Array([2, 0])),
            ],
            [
              util.BN.new(new Int32Array([3, 0])),
              util.BN.new(new Int32Array([4, 0])),
            ],
          ],
          types: {
            index: [
              {
                name: "uint64",
                meta: null,
              },
            ],
            data: ["int64", "int64"],
          },
        })
      })

      test("unicode", () => {
        const mockElement = { data: UNICODE }
        const q = new Quiver(mockElement)

        q.addRows(q)
        expect(q).toEqual({
          index: [["i1"], ["i2"], ["i1"], ["i2"]],
          columns: [["c1", "c2"]],
          data: [
            ["foo", "1"],
            ["bar", "2"],
            ["foo", "1"],
            ["bar", "2"],
          ],
          types: {
            index: [{ name: "unicode", meta: null }],
            data: ["unicode", "unicode"],
          },
        })
      })
    })

    describe("Special cases", () => {
      test("multi-index", () => {
        const mockElement = { data: MULTI }
        const q = new Quiver(mockElement)

        q.addRows(q)
        expect(q).toEqual({
          index: [
            [util.BN.new(new Int32Array([1, 0])), "red"],
            [util.BN.new(new Int32Array([2, 0])), "blue"],
            [util.BN.new(new Int32Array([1, 0])), "red"],
            [util.BN.new(new Int32Array([2, 0])), "blue"],
          ],
          columns: [
            ["1", "2"],
            ["red", "blue"],
          ],
          data: [
            ["foo", "1"],
            ["bar", "2"],
            ["foo", "1"],
            ["bar", "2"],
          ],
          types: {
            index: [
              {
                name: "int64",
                meta: null,
              },
              {
                name: "unicode",
                meta: null,
              },
            ],
            data: ["unicode", "unicode"],
          },
        })
      })

      test("DataFrames with different column types", () => {
        const mockElement1 = { data: UNICODE }
        const mockElement2 = { data: DIFFERENT_COLUMN_TYPES }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        q1.addRows(q2)
        expect(q1).toEqual({
          index: [["i1"], ["i2"], ["i1"], ["i2"]],
          columns: [["c1", "c2"]],
          data: [
            ["foo", "1"],
            ["bar", "2"],
            ["baz", "1"],
            ["qux", "2"],
          ],
          types: {
            index: [{ name: "unicode", meta: null }],
            data: ["unicode", "unicode"],
          },
        })
      })

      it("shows df2 if df1 is empty", () => {
        const mockElement1 = { data: EMPTY }
        const mockElement2 = { data: UNICODE }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        q1.addRows(q2)
        expect(q1).toEqual(q2)
      })

      it("shows df1 if df2 is empty", () => {
        const mockElement1 = { data: EMPTY }
        const mockElement2 = { data: UNICODE }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        q2.addRows(q1)
        expect(q2).toEqual(q2)
      })

      it("shows an empty DataFrame if both df1 and df2 are empty", () => {
        const mockElement = { data: EMPTY }
        const q1 = new Quiver(mockElement)
        const q2 = new Quiver(mockElement)

        q1.addRows(q2)
        expect(q1.isEmpty()).toBe(true)
      })

      it("uses df1 columns if df2 has more columns than df1", () => {
        const mockElement1 = { data: FEWER_COLUMNS }
        const mockElement2 = { data: UNICODE }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        q1.addRows(q2)
        expect(q1).toEqual({
          index: [["i1"], ["i2"], ["i1"], ["i2"]],
          columns: [["c1"]],
          data: [["foo"], ["bar"], ["foo"], ["bar"]],
          types: {
            index: [{ name: "unicode", meta: null }],
            data: ["unicode"],
          },
        })
      })

      it("throws an error if df1 has more columns than df2", () => {
        const mockElement1 = { data: UNICODE }
        const mockElement2 = { data: FEWER_COLUMNS }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        expect(() => q1.addRows(q2)).toThrow(
          'Cannot concatenate data type ["unicode","unicode"] with ["unicode"].'
        )
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

        expect(() => q1.addRows(q2)).toThrow(
          "Cannot concatenate DataFrames with Styler."
        )

        expect(() => q2.addRows(q1)).toThrow(
          "Cannot concatenate DataFrames with Styler."
        )
      })

      it("throws an error if DataFrames have different index types", () => {
        const mockElement1 = { data: UNICODE }
        const mockElement2 = { data: RANGE }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        expect(() => q1.addRows(q2)).toThrow(
          'Cannot concatenate index type [{"name":"unicode","meta":null}] with [{"name":"range","meta":{"kind":"range","name":null,"start":0,"stop":2,"step":1}}].'
        )
      })

      it("throws an error if DataFrames have different data types", () => {
        const mockElement1 = { data: UNICODE }
        const mockElement2 = { data: INT64 }
        const q1 = new Quiver(mockElement1)
        const q2 = new Quiver(mockElement2)

        expect(() => q1.addRows(q2)).toThrow(
          'Cannot concatenate index type [{"name":"unicode","meta":null}] with [{"name":"int64","meta":null}].'
        )
      })
    })
  })
})
