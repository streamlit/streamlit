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

import { UNICODE } from "~lib/mocks/arrow/types/unicode"

import { dataframe, table, text, vegaLiteChart } from "./test-utils"
import { TransientNode } from "./TransientNode"

describe("ElementNode", () => {
  describe("ElementNode.quiverElement", () => {
    it("returns a quiverElement (table)", () => {
      const node = table()
      const q = node.quiverElement
      expect(q.columnNames).toEqual([["", "c1", "c2"]])
      expect(q.getCell(0, 0).content).toEqual("i1")
    })

    it("returns a quiverElement (dataframe)", () => {
      const node = dataframe()
      const q = node.quiverElement
      expect(q.columnNames).toEqual([["", "c1", "c2"]])
      expect(q.getCell(0, 0).content).toEqual("i1")
    })

    it("does not recompute its value (table)", () => {
      // accessing `quiverElement` twice should return the same instance.
      const node = table()
      expect(node.quiverElement).toStrictEqual(node.quiverElement)
    })

    it("does not recompute its value (dataframe)", () => {
      // accessing `quiverElement` twice should return the same instance.
      const node = dataframe()
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
      const node = vegaLiteChart(MOCK_VEGA_LITE_CHART)
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
      const node = vegaLiteChart(MOCK_VEGA_LITE_CHART)
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
      const node = vegaLiteChart(MOCK_VEGA_LITE_CHART)
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
})

describe("ElementNode.accept", () => {
  it("calls visitElementNode on the visitor", () => {
    const node = text("test")
    const mockVisitor = {
      visitElementNode: vi.fn().mockReturnValue("element-result"),
      visitBlockNode: vi.fn().mockReturnValue("block-result"),
      visitTransientNode: vi.fn().mockReturnValue("transient-result"),
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
      visitTransientNode: vi.fn(),
    }

    const result = node.accept(identityVisitor)

    expect(result).toBe(node)
  })

  it("allows visitor to return undefined", () => {
    const node = text("test")
    const nullVisitor = {
      visitElementNode: vi.fn().mockReturnValue(undefined),
      visitBlockNode: vi.fn(),
      visitTransientNode: vi.fn(),
    }

    const result = node.accept(nullVisitor)

    expect(result).toBeUndefined()
  })
})

describe("ElementNode.replaceTransientNodeWithSelf", () => {
  it("returns this when transient node scriptRunId differs", () => {
    const el = text("a", "runA")
    const t = new TransientNode("runB", text("anchor"), [text("t")], 1)
    const result = el.replaceTransientNodeWithSelf(t)
    expect(result).toBe(el)
  })

  it("returns this when transient node has no transients", () => {
    const el = text("a", "runA")
    const t = new TransientNode("runA", text("anchor"), [], 1)
    const result = el.replaceTransientNodeWithSelf(t)
    expect(result).toBe(el)
  })

  it("returns TransientNode anchored to this element with filtered transients", () => {
    const runId = "cur"
    const el = text("a", runId)
    const keep = text("keep", runId)
    const drop = text("drop", "old")
    const t = new TransientNode(
      runId,
      text("old-anchor", "old"),
      [keep, drop],
      42
    )

    const result = el.replaceTransientNodeWithSelf(t) as TransientNode
    expect(result).toBeInstanceOf(TransientNode)
    expect(result.anchor).toBe(el)
    expect(result.transientNodes).toEqual([keep])
    expect(result.scriptRunId).toBe(runId)
    expect(result.deltaMsgReceivedAt).toBe(42)
  })
})
