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

import { ArrowNamedDataSet, IArrowVegaLiteChart } from "@streamlit/protobuf"

import { UNICODE } from "~lib/mocks/arrow"

import { NO_SCRIPT_RUN_ID } from "./AppNode.interface"
import {
  arrowDataFrame,
  arrowTable,
  arrowVegaLiteChart,
  text,
} from "./test-utils"

describe("ElementNode", () => {
  describe("ElementNode.quiverElement", () => {
    it("returns a quiverElement (arrowTable)", () => {
      const node = arrowTable()
      const q = node.quiverElement
      expect(q.columnNames).toEqual([["", "c1", "c2"]])
      expect(q.getCell(0, 0).content).toEqual("i1")
    })

    it("returns a quiverElement (arrowDataFrame)", () => {
      const node = arrowDataFrame()
      const q = node.quiverElement
      expect(q.columnNames).toEqual([["", "c1", "c2"]])
      expect(q.getCell(0, 0).content).toEqual("i1")
    })

    it("does not recompute its value (arrowTable)", () => {
      // accessing `quiverElement` twice should return the same instance.
      const node = arrowTable()
      expect(node.quiverElement).toStrictEqual(node.quiverElement)
    })

    it("does not recompute its value (arrowDataFrame)", () => {
      // accessing `quiverElement` twice should return the same instance.
      const node = arrowDataFrame()
      expect(node.quiverElement).toStrictEqual(node.quiverElement)
    })

    it("throws an error for other element types", () => {
      const node = text("foo")
      expect(() => node.quiverElement).toThrow(
        "elementType 'text' is not a valid Quiver element!"
      )
    })
  })

  describe("ElementNode.vegaLiteChartElement", () => {
    it("returns a vegaLiteChartElement (data)", () => {
      const MOCK_VEGA_LITE_CHART = {
        spec: JSON.stringify({
          mark: "circle",
          encoding: {
            x: { field: "a", type: "quantitative" },
            y: { field: "b", type: "quantitative" },
            size: { field: "c", type: "quantitative" },
            color: { field: "c", type: "quantitative" },
          },
        }),
        data: { data: UNICODE },
        datasets: [],
        useContainerWidth: true,
      }
      const node = arrowVegaLiteChart(MOCK_VEGA_LITE_CHART)
      const element = node.vegaLiteChartElement

      // spec
      expect(element.spec).toEqual(MOCK_VEGA_LITE_CHART.spec)

      // data
      expect(element.data?.columnNames).toEqual([["", "c1", "c2"]])
      expect(element.data?.getCell(0, 0).content).toEqual("i1")

      // datasets
      expect(element.datasets.length).toEqual(0)

      // use container width
      expect(element.useContainerWidth).toEqual(
        MOCK_VEGA_LITE_CHART.useContainerWidth
      )
    })

    it("returns a vegaLiteChartElement (datasets)", () => {
      const MOCK_VEGA_LITE_CHART = {
        spec: JSON.stringify({
          mark: "circle",
          encoding: {
            x: { field: "a", type: "quantitative" },
            y: { field: "b", type: "quantitative" },
            size: { field: "c", type: "quantitative" },
            color: { field: "c", type: "quantitative" },
          },
        }),
        data: null,
        datasets: [{ hasName: true, name: "foo", data: { data: UNICODE } }],
        useContainerWidth: true,
      }
      const node = arrowVegaLiteChart(MOCK_VEGA_LITE_CHART)
      const element = node.vegaLiteChartElement

      // spec
      expect(element.spec).toEqual(MOCK_VEGA_LITE_CHART.spec)

      // data
      expect(element.data).toEqual(null)

      // datasets
      expect(element.datasets[0].hasName).toEqual(
        MOCK_VEGA_LITE_CHART.datasets[0].hasName
      )
      expect(element.datasets[0].name).toEqual(
        MOCK_VEGA_LITE_CHART.datasets[0].name
      )
      expect(element.datasets[0].data.columnNames).toEqual([["", "c1", "c2"]])
      expect(element.datasets[0].data.getCell(0, 0).content).toEqual("i1")

      // use container width
      expect(element.useContainerWidth).toEqual(
        MOCK_VEGA_LITE_CHART.useContainerWidth
      )
    })

    it("does not recompute its value", () => {
      const MOCK_VEGA_LITE_CHART = {
        spec: JSON.stringify({
          mark: "circle",
          encoding: {
            x: { field: "a", type: "quantitative" },
            y: { field: "b", type: "quantitative" },
            size: { field: "c", type: "quantitative" },
            color: { field: "c", type: "quantitative" },
          },
        }),
        data: { data: UNICODE },
        datasets: [],
        useContainerWidth: true,
      }
      // accessing `vegaLiteChartElement` twice should return the same instance.
      const node = arrowVegaLiteChart(MOCK_VEGA_LITE_CHART)
      expect(node.vegaLiteChartElement).toStrictEqual(
        node.vegaLiteChartElement
      )
    })

    it("throws an error for other element types", () => {
      const node = text("foo")
      expect(() => node.vegaLiteChartElement).toThrow(
        "elementType 'text' is not a valid VegaLiteChartElement!"
      )
    })
  })

  describe("ElementNode.arrowAddRows", () => {
    const MOCK_UNNAMED_DATASET = {
      hasName: false,
      name: "",
      data: { data: UNICODE },
    } as ArrowNamedDataSet
    const MOCK_NAMED_DATASET = {
      hasName: true,
      name: "foo",
      data: { data: UNICODE },
    } as ArrowNamedDataSet
    const MOCK_ANOTHER_NAMED_DATASET = {
      hasName: true,
      name: "bar",
      data: { data: UNICODE },
    } as ArrowNamedDataSet

    describe("arrowTable", () => {
      test("addRows can be called with an unnamed dataset", () => {
        const node = arrowTable()
        const newNode = node.arrowAddRows(
          MOCK_UNNAMED_DATASET,
          NO_SCRIPT_RUN_ID
        )
        const q = newNode.quiverElement

        expect(q.columnNames).toEqual([["", "c1", "c2"]])
        expect(q.dimensions.numDataRows).toEqual(4)
        expect(q.getCell(0, 0).content).toEqual("i1")
        expect(q.getCell(2, 0).content).toEqual("i1")
        expect(q.getCell(0, 1).content).toEqual("foo")
        expect(q.getCell(2, 1).content).toEqual("foo")
      })

      test("addRows throws an error when called with a named dataset", () => {
        const node = arrowTable()
        expect(() =>
          node.arrowAddRows(MOCK_NAMED_DATASET, NO_SCRIPT_RUN_ID)
        ).toThrow(
          "Add rows cannot be used with a named dataset for this element."
        )
      })
    })

    describe("arrowDataFrame", () => {
      test("addRows can be called with an unnamed dataset", () => {
        const node = arrowDataFrame()
        const newNode = node.arrowAddRows(
          MOCK_UNNAMED_DATASET,
          NO_SCRIPT_RUN_ID
        )
        const q = newNode.quiverElement

        expect(q.columnNames).toEqual([["", "c1", "c2"]])
        expect(q.dimensions.numDataRows).toEqual(4)
        expect(q.getCell(0, 0).content).toEqual("i1")
        expect(q.getCell(2, 0).content).toEqual("i1")
        expect(q.getCell(0, 1).content).toEqual("foo")
        expect(q.getCell(2, 1).content).toEqual("foo")
      })

      test("addRows throws an error when called with a named dataset", () => {
        const node = arrowDataFrame()
        expect(() =>
          node.arrowAddRows(MOCK_NAMED_DATASET, NO_SCRIPT_RUN_ID)
        ).toThrow(
          "Add rows cannot be used with a named dataset for this element."
        )
      })
    })

    describe("arrowVegaLiteChart", () => {
      const getVegaLiteChart = (
        datasets?: ArrowNamedDataSet[],
        data?: Uint8Array
      ): IArrowVegaLiteChart => ({
        datasets: datasets || [],
        data: data ? { data } : null,
        spec: JSON.stringify({
          mark: "circle",
          encoding: {
            x: { field: "a", type: "quantitative" },
            y: { field: "b", type: "quantitative" },
            size: { field: "c", type: "quantitative" },
            color: { field: "c", type: "quantitative" },
          },
        }),
        useContainerWidth: true,
      })

      describe("addRows is called with a named dataset", () => {
        test("element has one dataset -> append new rows to that dataset", () => {
          const node = arrowVegaLiteChart(
            getVegaLiteChart([MOCK_ANOTHER_NAMED_DATASET])
          )
          const newNode = node.arrowAddRows(
            MOCK_NAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          const quiverData = element.datasets[0].data
          expect(quiverData?.columnNames).toEqual([["", "c1", "c2"]])
          expect(quiverData?.dimensions.numDataRows).toEqual(4)

          expect(quiverData?.getCell(0, 0).content).toEqual("i1")
          expect(quiverData?.getCell(0, 1).content).toEqual("foo")
          expect(quiverData?.getCell(2, 0).content).toEqual("i1")
          expect(quiverData?.getCell(2, 1).content).toEqual("foo")
        })

        test("element has a dataset with the given name -> append new rows to that dataset", () => {
          const node = arrowVegaLiteChart(
            getVegaLiteChart([MOCK_NAMED_DATASET, MOCK_ANOTHER_NAMED_DATASET])
          )
          const newNode = node.arrowAddRows(
            MOCK_NAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          const quiverData = element.datasets[0].data
          expect(quiverData?.columnNames).toEqual([["", "c1", "c2"]])
          expect(quiverData?.dimensions.numDataRows).toEqual(4)

          expect(quiverData?.getCell(0, 0).content).toEqual("i1")
          expect(quiverData?.getCell(0, 1).content).toEqual("foo")
          expect(quiverData?.getCell(2, 0).content).toEqual("i1")
          expect(quiverData?.getCell(2, 1).content).toEqual("foo")
        })

        test("element doesn't have a matched dataset, but has data -> append new rows to data", () => {
          const node = arrowVegaLiteChart(getVegaLiteChart(undefined, UNICODE))
          const newNode = node.arrowAddRows(
            MOCK_NAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          const quiverData = element.data
          expect(quiverData?.columnNames).toEqual([["", "c1", "c2"]])
          expect(quiverData?.dimensions.numDataRows).toEqual(4)

          expect(quiverData?.getCell(0, 0).content).toEqual("i1")
          expect(quiverData?.getCell(0, 1).content).toEqual("foo")
          expect(quiverData?.getCell(2, 0).content).toEqual("i1")
          expect(quiverData?.getCell(2, 1).content).toEqual("foo")
        })

        test("element doesn't have a matched dataset or data -> use new rows as data", () => {
          const node = arrowVegaLiteChart(
            getVegaLiteChart([
              MOCK_ANOTHER_NAMED_DATASET,
              MOCK_ANOTHER_NAMED_DATASET,
            ])
          )
          const newNode = node.arrowAddRows(
            MOCK_NAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          const quiverData = element.data
          expect(quiverData?.columnNames).toEqual([["", "c1", "c2"]])
          expect(quiverData?.dimensions.numDataRows).toEqual(2)

          expect(quiverData?.getCell(0, 0).content).toEqual("i1")
          expect(quiverData?.getCell(0, 1).content).toEqual("foo")
        })

        test("element doesn't have any datasets or data -> use new rows as data", () => {
          const node = arrowVegaLiteChart(getVegaLiteChart())
          const newNode = node.arrowAddRows(
            MOCK_NAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          const quiverData = element.data
          expect(quiverData?.columnNames).toEqual([["", "c1", "c2"]])
          expect(quiverData?.dimensions.numDataRows).toEqual(2)

          expect(quiverData?.getCell(0, 0).content).toEqual("i1")
          expect(quiverData?.getCell(0, 1).content).toEqual("foo")
        })
      })

      describe("addRows is called with an unnamed dataset", () => {
        test("element has one dataset -> append new rows to that dataset", () => {
          const node = arrowVegaLiteChart(
            getVegaLiteChart([MOCK_NAMED_DATASET])
          )
          const newNode = node.arrowAddRows(
            MOCK_UNNAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          const quiverData = element.datasets[0].data
          expect(quiverData.columnNames).toEqual([["", "c1", "c2"]])
          expect(quiverData?.dimensions.numDataRows).toEqual(4)

          expect(quiverData.getCell(0, 0).content).toEqual("i1")
          expect(quiverData.getCell(2, 0).content).toEqual("i1")
          expect(quiverData.getCell(0, 1).content).toEqual("foo")
          expect(quiverData.getCell(2, 1).content).toEqual("foo")
        })

        test("element has data -> append new rows to data", () => {
          const node = arrowVegaLiteChart(getVegaLiteChart(undefined, UNICODE))
          const newNode = node.arrowAddRows(
            MOCK_UNNAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          const quiverData = element.data
          expect(quiverData?.columnNames).toEqual([["", "c1", "c2"]])
          expect(quiverData?.dimensions.numDataRows).toEqual(4)

          expect(quiverData?.getCell(0, 0).content).toEqual("i1")
          expect(quiverData?.getCell(2, 0).content).toEqual("i1")
          expect(quiverData?.getCell(0, 1).content).toEqual("foo")
          expect(quiverData?.getCell(2, 1).content).toEqual("foo")
        })

        test("element doesn't have any datasets or data -> use new rows as data", () => {
          const node = arrowVegaLiteChart(getVegaLiteChart())
          const newNode = node.arrowAddRows(
            MOCK_UNNAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          const quiverData = element.data
          expect(quiverData?.columnNames).toEqual([["", "c1", "c2"]])
          expect(quiverData?.dimensions.numDataRows).toEqual(2)

          expect(quiverData?.getCell(0, 0).content).toEqual("i1")
          expect(quiverData?.getCell(0, 1).content).toEqual("foo")
        })
      })
    })

    it("throws an error for other element types", () => {
      const node = text("foo")
      expect(() =>
        node.arrowAddRows(MOCK_UNNAMED_DATASET, NO_SCRIPT_RUN_ID)
      ).toThrow("elementType 'text' is not a valid arrowAddRows target!")
    })
  })
})
