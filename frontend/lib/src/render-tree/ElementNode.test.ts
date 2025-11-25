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
  describe("ElementNode.arrowData", () => {
    it("returns arrowData (arrowTable)", () => {
      const node = arrowTable()
      const arrowData = node.arrowData
      expect(arrowData.data).toBeDefined()
      expect(arrowData.data.data).toBeDefined()
    })

    it("returns arrowData (arrowDataFrame)", () => {
      const node = arrowDataFrame()
      const arrowData = node.arrowData
      expect(arrowData.data).toBeDefined()
      expect(arrowData.data.data).toBeDefined()
    })

    it("does not recompute its value (arrowTable)", () => {
      // accessing `arrowData` twice should return the same instance.
      const node = arrowTable()
      expect(node.arrowData).toStrictEqual(node.arrowData)
    })

    it("does not recompute its value (arrowDataFrame)", () => {
      // accessing `arrowData` twice should return the same instance.
      const node = arrowDataFrame()
      expect(node.arrowData).toStrictEqual(node.arrowData)
    })

    it("throws an error for other element types", () => {
      const node = text("foo")
      expect(() => node.arrowData).toThrow(
        "elementType 'text' is not a valid Arrow element!"
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
      expect(element.proto.spec).toEqual(MOCK_VEGA_LITE_CHART.spec)

      // data - returns raw proto
      expect(element.proto.data).toBeDefined()
      expect(element.proto.data?.data).toBeDefined()

      // datasets
      expect(element.proto.datasets?.length).toEqual(0)

      // use container width
      expect(element.proto.useContainerWidth).toEqual(
        MOCK_VEGA_LITE_CHART.useContainerWidth
      )
    })

    it("returns a vegaLiteChartElement proto (datasets)", () => {
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
      expect(element.proto.spec).toEqual(MOCK_VEGA_LITE_CHART.spec)

      // data - returns raw proto
      expect(element.proto.data).toEqual(null)

      // datasets - returns raw proto
      expect(element.proto.datasets?.[0]?.hasName).toEqual(true)
      expect(element.proto.datasets?.[0]?.name).toEqual("foo")
      expect(element.proto.datasets?.[0]?.data).toBeDefined()
      expect(element.proto.datasets?.[0]?.data?.data).toBeDefined()

      // use container width
      expect(element.proto.useContainerWidth).toEqual(
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
      test("addRows stores the added rows data", () => {
        const node = arrowTable()
        const newNode = node.arrowAddRows(
          MOCK_UNNAMED_DATASET,
          NO_SCRIPT_RUN_ID
        )
        const arrowData = newNode.arrowData

        // Check that we have both original data and addedRows
        expect(arrowData.data).toBeDefined()
        expect(arrowData.addedRowsList).toBeDefined()
        expect(arrowData.addedRowsList).toHaveLength(1)
        expect(arrowData.addedRowsList?.[0]).toBe(MOCK_UNNAMED_DATASET.data)
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
      test("addRows stores the added rows data", () => {
        const node = arrowDataFrame()
        const newNode = node.arrowAddRows(
          MOCK_UNNAMED_DATASET,
          NO_SCRIPT_RUN_ID
        )
        const arrowData = newNode.arrowData

        // Check that we have both original data and addedRows
        expect(arrowData.data).toBeDefined()
        expect(arrowData.addedRowsList).toBeDefined()
        expect(arrowData.addedRowsList).toHaveLength(1)
        expect(arrowData.addedRowsList?.[0]).toBe(MOCK_UNNAMED_DATASET.data)
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
        test("element has one dataset -> stores add rows data for component to handle", () => {
          const node = arrowVegaLiteChart(
            getVegaLiteChart([MOCK_ANOTHER_NAMED_DATASET])
          )
          const newNode = node.arrowAddRows(
            MOCK_NAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          // Element now returns proto and addedRowsList separately
          expect(element.addedRowsList).toBeDefined()
          expect(element.addedRowsList).toHaveLength(1)
          expect(element.addedRowsList?.[0].hasName).toBe(true)
          expect(element.addedRowsList?.[0].name).toEqual("foo")
          expect(element.addedRowsList?.[0].data).toBe(MOCK_NAMED_DATASET.data)
        })

        test("element has a dataset with the given name -> stores add rows data", () => {
          const node = arrowVegaLiteChart(
            getVegaLiteChart([MOCK_NAMED_DATASET, MOCK_ANOTHER_NAMED_DATASET])
          )
          const newNode = node.arrowAddRows(
            MOCK_NAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          expect(element.addedRowsList).toBeDefined()
          expect(element.addedRowsList).toHaveLength(1)
          expect(element.addedRowsList?.[0].hasName).toBe(true)
          expect(element.addedRowsList?.[0].name).toEqual("foo")
        })

        test("element doesn't have a matched dataset, but has data -> stores add rows data", () => {
          const node = arrowVegaLiteChart(getVegaLiteChart(undefined, UNICODE))
          const newNode = node.arrowAddRows(
            MOCK_NAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          expect(element.addedRowsList).toBeDefined()
          expect(element.addedRowsList).toHaveLength(1)
          expect(element.addedRowsList?.[0].hasName).toBe(true)
        })

        test("element doesn't have a matched dataset or data -> stores add rows data", () => {
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

          expect(element.addedRowsList).toBeDefined()
          expect(element.addedRowsList).toHaveLength(1)
          expect(element.addedRowsList?.[0].hasName).toBe(true)
        })

        test("element doesn't have any datasets or data -> stores add rows data", () => {
          const node = arrowVegaLiteChart(getVegaLiteChart())
          const newNode = node.arrowAddRows(
            MOCK_NAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          expect(element.addedRowsList).toBeDefined()
          expect(element.addedRowsList).toHaveLength(1)
          expect(element.addedRowsList?.[0].hasName).toBe(true)
        })
      })

      describe("addRows is called with an unnamed dataset", () => {
        test("element has one dataset -> stores add rows data", () => {
          const node = arrowVegaLiteChart(
            getVegaLiteChart([MOCK_NAMED_DATASET])
          )
          const newNode = node.arrowAddRows(
            MOCK_UNNAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          expect(element.addedRowsList).toBeDefined()
          expect(element.addedRowsList).toHaveLength(1)
          expect(element.addedRowsList?.[0].hasName).toBe(false)
        })

        test("element has data -> stores add rows data", () => {
          const node = arrowVegaLiteChart(getVegaLiteChart(undefined, UNICODE))
          const newNode = node.arrowAddRows(
            MOCK_UNNAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          expect(element.addedRowsList).toBeDefined()
          expect(element.addedRowsList).toHaveLength(1)
          expect(element.addedRowsList?.[0].hasName).toBe(false)
        })

        test("element doesn't have any datasets or data -> stores add rows data", () => {
          const node = arrowVegaLiteChart(getVegaLiteChart())
          const newNode = node.arrowAddRows(
            MOCK_UNNAMED_DATASET,
            NO_SCRIPT_RUN_ID
          )
          const element = newNode.vegaLiteChartElement

          expect(element.addedRowsList).toBeDefined()
          expect(element.addedRowsList).toHaveLength(1)
          expect(element.addedRowsList?.[0].hasName).toBe(false)
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

describe("ElementNode.accept", () => {
  it("calls visitElementNode on the visitor", () => {
    const node = text("test")
    const mockVisitor = {
      visitElementNode: vi.fn().mockReturnValue("element-result"),
      visitBlockNode: vi.fn().mockReturnValue("block-result"),
    }

    const result = node.accept(mockVisitor)

    expect(mockVisitor.visitElementNode).toHaveBeenCalledWith(node)
    expect(mockVisitor.visitBlockNode).not.toHaveBeenCalled()
    expect(result).toEqual("element-result")
  })

  it("allows visitor to return the same node", () => {
    const node = text("test")
    const identityVisitor = {
      visitElementNode: vi.fn().mockReturnValue(node),
      visitBlockNode: vi.fn(),
    }

    const result = node.accept(identityVisitor)

    expect(result).toBe(node)
  })

  it("allows visitor to return undefined", () => {
    const node = text("test")
    const nullVisitor = {
      visitElementNode: vi.fn().mockReturnValue(undefined),
      visitBlockNode: vi.fn(),
    }

    const result = node.accept(nullVisitor)

    expect(result).toBeUndefined()
  })
})
