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

import { ArrowNamedDataSet } from "@streamlit/protobuf"

import { UNICODE } from "~lib/mocks/arrow"

import {
  arrowDataFrame,
  arrowTable,
  arrowVegaLiteChart,
  NO_SCRIPT_RUN_ID,
  text,
} from "./test-utils"
import { ElementsSetVisitor } from "./visitors/ElementsSetVisitor"

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

  describe("arrowTable", () => {
    test("addRows can be called with an unnamed dataset", () => {
      const node = arrowTable()
      const newNode = node.arrowAddRows(MOCK_UNNAMED_DATASET, NO_SCRIPT_RUN_ID)
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

  it("throws an error for other element types", () => {
    const node = text("foo")
    expect(() =>
      node.arrowAddRows(MOCK_UNNAMED_DATASET, NO_SCRIPT_RUN_ID)
    ).toThrow("elementType 'text' is not a valid arrowAddRows target!")
  })
})

describe("ElementNode.visit", () => {
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

describe("ElementNode with ElementsSetVisitor", () => {
  it("can be visited by ElementsSetVisitor to collect elements", () => {
    const node = text("test")
    const visitor = new ElementsSetVisitor()

    const result = node.accept(visitor)

    expect(result.size).toBe(1)
    expect(result.has(node.element)).toBe(true)
    expect(visitor.elements.size).toBe(1)
    expect(visitor.elements.has(node.element)).toBe(true)
  })

  it("works with ElementsSetVisitor static method", () => {
    const node = text("test")

    const elements = ElementsSetVisitor.collectElements(node)

    expect(elements.size).toBe(1)
    expect(elements.has(node.element)).toBe(true)
  })
})
