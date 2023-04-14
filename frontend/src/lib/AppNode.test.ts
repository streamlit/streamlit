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

import {
  ArrowNamedDataSet,
  Block as BlockProto,
  Delta as DeltaProto,
  Element,
  ForwardMsgMetadata,
  IArrowVegaLiteChart,
  NamedDataSet,
} from "src/autogen/proto"
import { IndexTypeName } from "src/lib/dataframes/Quiver"
import { mockDataFrame as mockDataFrameData } from "src/components/elements/DataFrame/mock"
import { Writer } from "protobufjs"
import { vectorFromArray } from "apache-arrow"
import { addRows } from "./dataframes/dataFrameProto"
import { toImmutableProto } from "./immutableProto"
import { BlockNode, ElementNode, AppNode, AppRoot } from "./AppNode"
import { UNICODE } from "./mocks/arrow"
import { MockMetricsManager } from "./mocks/mocks"

const NO_SCRIPT_RUN_ID = "NO_SCRIPT_RUN_ID"

// prettier-ignore
const BLOCK = block([
  text("1"),
  block([
    text("2"),
  ]),
])

const ROOT = new AppRoot(
  new MockMetricsManager(),
  new BlockNode([BLOCK, new BlockNode()])
)

describe("AppNode.getIn", () => {
  it("handles shallow paths", () => {
    const node = BLOCK.getIn([0])
    expect(node).toBeTextNode("1")
  })

  it("handles deep paths", () => {
    const node = BLOCK.getIn([1, 0])
    expect(node).toBeTextNode("2")
  })

  it("returns undefined for invalid paths", () => {
    const node = BLOCK.getIn([2, 3, 4])
    expect(node).toBeUndefined()
  })
})

describe("AppNode.setIn", () => {
  it("handles shallow paths", () => {
    const newBlock = BLOCK.setIn([0], text("new"), NO_SCRIPT_RUN_ID)
    expect(newBlock.getIn([0])).toBeTextNode("new")

    // Check BLOCK..newBlock diff is as expected.
    expect(newBlock).not.toStrictEqual(BLOCK)
    expect(newBlock.getIn([1])).toStrictEqual(BLOCK.getIn([1]))
  })

  it("handles deep paths", () => {
    const newBlock = BLOCK.setIn([1, 1], text("new"), NO_SCRIPT_RUN_ID)
    expect(newBlock.getIn([1, 1])).toBeTextNode("new")

    // Check BLOCK..newBlock diff is as expected
    expect(newBlock).not.toStrictEqual(BLOCK)
    expect(newBlock.getIn([0])).toStrictEqual(BLOCK.getIn([0]))
    expect(newBlock.getIn([1])).not.toStrictEqual(BLOCK.getIn([1]))
    expect(newBlock.getIn([1, 0])).toStrictEqual(BLOCK.getIn([1, 0]))
    expect(newBlock.getIn([1, 1])).not.toStrictEqual(BLOCK.getIn([1, 1]))
  })

  it("throws an error for invalid paths", () => {
    expect(() => BLOCK.setIn([1, 2], text("new"), NO_SCRIPT_RUN_ID)).toThrow(
      "Bad 'setIn' index 2 (should be between [0, 1])"
    )
  })
})

describe("ElementNode.immutableElement", () => {
  it("returns an immutableJS element", () => {
    const node = text("ahoy!")
    expect(node.immutableElement).toEqual(
      toImmutableProto(Element, new Element({ text: { body: "ahoy!" } }))
    )
  })

  it("does not recompute its value", () => {
    // accessing `immutableElement` twice should return the same instance.
    const node = text("ahoy!")
    expect(node.immutableElement).toStrictEqual(node.immutableElement)
  })
})

describe("ElementNode.quiverElement", () => {
  it("returns a quiverElement (arrowTable)", () => {
    const node = arrowTable()
    const q = node.quiverElement

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

  it("returns a quiverElement (arrowDataFrame)", () => {
    const node = arrowDataFrame()
    const q = node.quiverElement

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
    expect(element.data?.index).toEqual([vectorFromArray(["i1", "i2"])])
    expect(element.data?.columns).toEqual([["c1", "c2"]])
    expect(element.data?.data.toArray().map(a => a?.toArray())).toEqual([
      ["foo", "1"],
      ["bar", "2"],
    ])
    expect(element.data?.types).toEqual({
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
    expect(element.datasets[0].data.index).toEqual([
      vectorFromArray(["i1", "i2"]),
    ])
    expect(element.datasets[0].data.columns).toEqual([["c1", "c2"]])
    expect(
      element.datasets[0].data.data.toArray().map(a => a?.toArray())
    ).toEqual([
      ["foo", "1"],
      ["bar", "2"],
    ])
    expect(element.datasets[0].data.types).toEqual({
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
    expect(node.vegaLiteChartElement).toStrictEqual(node.vegaLiteChartElement)
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
      const newNode = node.arrowAddRows(MOCK_UNNAMED_DATASET, NO_SCRIPT_RUN_ID)
      const q = newNode.quiverElement

      expect(q.index).toEqual([vectorFromArray(["i1", "i2", "i1", "i2"])])
      expect(q.columns).toEqual([["c1", "c2"]])
      expect(q.data.toArray().map(a => a?.toArray())).toEqual([
        ["foo", "1"],
        ["bar", "2"],
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
      const newNode = node.arrowAddRows(MOCK_UNNAMED_DATASET, NO_SCRIPT_RUN_ID)
      const q = newNode.quiverElement

      expect(q.index).toEqual([vectorFromArray(["i1", "i2", "i1", "i2"])])
      expect(q.columns).toEqual([["c1", "c2"]])
      expect(q.data.toArray().map(a => a?.toArray())).toEqual([
        ["foo", "1"],
        ["bar", "2"],
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
        const newNode = node.arrowAddRows(MOCK_NAMED_DATASET, NO_SCRIPT_RUN_ID)
        const element = newNode.vegaLiteChartElement

        expect(element.datasets[0].data.index).toEqual([
          vectorFromArray(["i1", "i2", "i1", "i2"]),
        ])
        expect(element.datasets[0].data.columns).toEqual([["c1", "c2"]])
        expect(
          element.datasets[0].data.data.toArray().map(a => a?.toArray())
        ).toEqual([
          ["foo", "1"],
          ["bar", "2"],
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(element.datasets[0].data.types).toEqual({
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

      test("element has a dataset with the given name -> append new rows to that dataset", () => {
        const node = arrowVegaLiteChart(
          getVegaLiteChart([MOCK_NAMED_DATASET, MOCK_ANOTHER_NAMED_DATASET])
        )
        const newNode = node.arrowAddRows(MOCK_NAMED_DATASET, NO_SCRIPT_RUN_ID)
        const element = newNode.vegaLiteChartElement

        expect(element.datasets[0].data.index).toEqual([
          vectorFromArray(["i1", "i2", "i1", "i2"]),
        ])
        expect(element.datasets[0].data.columns).toEqual([["c1", "c2"]])
        expect(
          element.datasets[0].data.data.toArray().map(a => a?.toArray())
        ).toEqual([
          ["foo", "1"],
          ["bar", "2"],
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(element.datasets[0].data.types).toEqual({
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

      test("element doesn't have a matched dataset, but has data -> append new rows to data", () => {
        const node = arrowVegaLiteChart(getVegaLiteChart(undefined, UNICODE))
        const newNode = node.arrowAddRows(MOCK_NAMED_DATASET, NO_SCRIPT_RUN_ID)
        const element = newNode.vegaLiteChartElement

        expect(element.data?.index).toEqual([
          vectorFromArray(["i1", "i2", "i1", "i2"]),
        ])
        expect(element.data?.columns).toEqual([["c1", "c2"]])
        expect(element.data?.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(element.data?.types).toEqual({
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

      test("element doesn't have a matched dataset or data -> use new rows as data", () => {
        const node = arrowVegaLiteChart(
          getVegaLiteChart([
            MOCK_ANOTHER_NAMED_DATASET,
            MOCK_ANOTHER_NAMED_DATASET,
          ])
        )
        const newNode = node.arrowAddRows(MOCK_NAMED_DATASET, NO_SCRIPT_RUN_ID)
        const element = newNode.vegaLiteChartElement

        expect(element.data?.index).toEqual([vectorFromArray(["i1", "i2"])])
        expect(element.data?.columns).toEqual([["c1", "c2"]])
        expect(element.data?.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(element.data?.types).toEqual({
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

      test("element doesn't have any datasets or data -> use new rows as data", () => {
        const node = arrowVegaLiteChart(getVegaLiteChart())
        const newNode = node.arrowAddRows(MOCK_NAMED_DATASET, NO_SCRIPT_RUN_ID)
        const element = newNode.vegaLiteChartElement

        expect(element.data?.index).toEqual([vectorFromArray(["i1", "i2"])])
        expect(element.data?.columns).toEqual([["c1", "c2"]])
        expect(element.data?.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(element.data?.types).toEqual({
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

    describe("addRows is called with an unnamed dataset", () => {
      test("element has one dataset -> append new rows to that dataset", () => {
        const node = arrowVegaLiteChart(getVegaLiteChart([MOCK_NAMED_DATASET]))
        const newNode = node.arrowAddRows(
          MOCK_UNNAMED_DATASET,
          NO_SCRIPT_RUN_ID
        )
        const element = newNode.vegaLiteChartElement

        expect(element.datasets[0].data.index).toEqual([
          vectorFromArray(["i1", "i2", "i1", "i2"]),
        ])
        expect(element.datasets[0].data.columns).toEqual([["c1", "c2"]])
        expect(
          element.datasets[0].data.data.toArray().map(a => a?.toArray())
        ).toEqual([
          ["foo", "1"],
          ["bar", "2"],
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(element.datasets[0].data.types).toEqual({
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

      test("element has data -> append new rows to data", () => {
        const node = arrowVegaLiteChart(getVegaLiteChart(undefined, UNICODE))
        const newNode = node.arrowAddRows(
          MOCK_UNNAMED_DATASET,
          NO_SCRIPT_RUN_ID
        )
        const element = newNode.vegaLiteChartElement

        expect(element.data?.index).toEqual([
          vectorFromArray(["i1", "i2", "i1", "i2"]),
        ])
        expect(element.data?.columns).toEqual([["c1", "c2"]])
        expect(element.data?.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(element.data?.types).toEqual({
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

      test("element doesn't have any datasets or data -> use new rows as data", () => {
        const node = arrowVegaLiteChart(getVegaLiteChart())
        const newNode = node.arrowAddRows(
          MOCK_UNNAMED_DATASET,
          NO_SCRIPT_RUN_ID
        )
        const element = newNode.vegaLiteChartElement

        expect(element.data?.index).toEqual([vectorFromArray(["i1", "i2"])])
        expect(element.data?.columns).toEqual([["c1", "c2"]])
        expect(element.data?.data.toArray().map(a => a?.toArray())).toEqual([
          ["foo", "1"],
          ["bar", "2"],
        ])
        expect(element.data?.types).toEqual({
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
  })

  it("throws an error for other element types", () => {
    const node = text("foo")
    expect(() =>
      node.arrowAddRows(MOCK_UNNAMED_DATASET, NO_SCRIPT_RUN_ID)
    ).toThrow("elementType 'text' is not a valid arrowAddRows target!")
  })
})

describe("AppRoot.empty", () => {
  it("creates an empty tree", () => {
    const empty = AppRoot.empty(new MockMetricsManager())
    expect(empty.main.isEmpty).toBe(true)
    expect(empty.sidebar.isEmpty).toBe(true)
  })

  it("creates placeholder alert", () => {
    const empty = AppRoot.empty(new MockMetricsManager(), "placeholder text!")

    expect(empty.main.children.length).toBe(1)
    const child = empty.main.getIn([0]) as ElementNode
    expect(child.element.alert?.body).toBe("placeholder text!")

    expect(empty.sidebar.isEmpty).toBe(true)
  })
})

describe("AppRoot.applyDelta", () => {
  it("handles 'newElement' deltas", () => {
    const delta = makeProto(DeltaProto, {
      newElement: { text: { body: "newElement!" } },
    })
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    )

    const newNode = newRoot.main.getIn([1, 1]) as ElementNode
    expect(newNode).toBeTextNode("newElement!")

    // Check that our new scriptRunId has been set only on the touched nodes
    expect(newRoot.main.scriptRunId).toBe("new_session_id")
    expect(newRoot.main.getIn([0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
    expect(newRoot.main.getIn([1])?.scriptRunId).toBe("new_session_id")
    expect(newRoot.main.getIn([1, 0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
    expect(newRoot.main.getIn([1, 1])?.scriptRunId).toBe("new_session_id")
    expect(newRoot.sidebar.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
  })

  it("handles 'addBlock' deltas", () => {
    const delta = makeProto(DeltaProto, { addBlock: {} })
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    )

    const newNode = newRoot.main.getIn([1, 1]) as BlockNode
    expect(newNode).toBeDefined()

    // Check that our new scriptRunId has been set only on the touched nodes
    expect(newRoot.main.scriptRunId).toBe("new_session_id")
    expect(newRoot.main.getIn([0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
    expect(newRoot.main.getIn([1])?.scriptRunId).toBe("new_session_id")
    expect(newRoot.main.getIn([1, 0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
    expect(newRoot.main.getIn([1, 1])?.scriptRunId).toBe("new_session_id")
    expect(newRoot.sidebar.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
  })

  const addRowsTypes = ["dataFrame", "table", "vegaLiteChart"]
  it.each(addRowsTypes)("handles 'addRows' for %s", elementType => {
    // Create an app with a dataframe node
    const root = AppRoot.empty(new MockMetricsManager()).applyDelta(
      "preAddRows",
      makeProto(DeltaProto, {
        newElement: { [elementType]: mockDataFrameData },
      }),
      forwardMsgMetadata([0, 0])
    )

    // Add rows
    const newRoot = root.applyDelta(
      "postAddRows",
      makeProto(DeltaProto, { addRows: { data: mockDataFrameData } }),
      forwardMsgMetadata([0, 0])
    )

    // Our new element should look like the result of calling `addRows`
    // with the same dataframe data twice.
    const expectedData = addRows(
      toImmutableProto(
        Element,
        makeProto(Element, { [elementType]: mockDataFrameData })
      ),
      toImmutableProto(
        NamedDataSet,
        makeProto(NamedDataSet, { data: mockDataFrameData })
      )
    )

    const addRowsElement = newRoot.main.getIn([0]) as ElementNode
    expect(addRowsElement.scriptRunId).toBe("postAddRows")
    expect(addRowsElement.immutableElement).toEqual(expectedData)
  })
})

describe("AppRoot.clearStaleNodes", () => {
  it("clears stale nodes", () => {
    // Add a new element and clear stale nodes
    const delta = makeProto(DeltaProto, {
      newElement: { text: { body: "newElement!" } },
    })
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    ).clearStaleNodes("new_session_id")

    // We should now only have a single element, inside a single block
    expect(newRoot.main.getIn([0, 0])).toBeTextNode("newElement!")
    expect(newRoot.getElements().size).toBe(1)
  })

  it("handles `allowEmpty` blocks correctly", () => {
    // Create a tree with two blocks, one with allowEmpty: true, and the other
    // with allowEmpty: false
    const newRoot = AppRoot.empty(new MockMetricsManager())
      .applyDelta(
        "new_session_id",
        makeProto(DeltaProto, { addBlock: { allowEmpty: true } }),
        forwardMsgMetadata([0, 0])
      )
      .applyDelta(
        "new_session_id",
        makeProto(DeltaProto, { addBlock: { allowEmpty: false } }),
        forwardMsgMetadata([0, 1])
      )

    expect(newRoot.main.getIn([0])).toBeInstanceOf(BlockNode)
    expect(newRoot.main.getIn([1])).toBeInstanceOf(BlockNode)

    // Prune nodes. Only the `allowEmpty` node should remain.
    const pruned = newRoot.clearStaleNodes("new_session_id")
    expect(pruned.main.getIn([0])).toBeInstanceOf(BlockNode)
    expect(pruned.main.getIn([1])).not.toBeDefined()
  })
})

describe("AppRoot.getElements", () => {
  it("returns all elements", () => {
    // We have elements at main.[0] and main.[1, 0]
    expect(ROOT.getElements()).toEqual(
      new Set([
        (ROOT.main.getIn([0]) as ElementNode).element,
        (ROOT.main.getIn([1, 0]) as ElementNode).element,
      ])
    )
  })
})

/** Create a `Text` element node with the given properties. */
function text(text: string, scriptRunId = NO_SCRIPT_RUN_ID): ElementNode {
  const element = makeProto(Element, { text: { body: text } })
  return new ElementNode(element, ForwardMsgMetadata.create(), scriptRunId)
}

/** Create a BlockNode with the given properties. */
function block(
  children: AppNode[] = [],
  scriptRunId = NO_SCRIPT_RUN_ID
): BlockNode {
  return new BlockNode(children, makeProto(BlockProto, {}), scriptRunId)
}

/** Create an arrowTable element node with the given properties. */
function arrowTable(scriptRunId = NO_SCRIPT_RUN_ID): ElementNode {
  const element = makeProto(Element, { arrowTable: { data: UNICODE } })
  return new ElementNode(element, ForwardMsgMetadata.create(), scriptRunId)
}

/** Create an arrowDataFrame element node with the given properties. */
function arrowDataFrame(scriptRunId = NO_SCRIPT_RUN_ID): ElementNode {
  const element = makeProto(Element, { arrowDataFrame: { data: UNICODE } })
  return new ElementNode(element, ForwardMsgMetadata.create(), scriptRunId)
}

/** Create an arrowVegaLiteChart element node with the given properties. */
function arrowVegaLiteChart(
  data: IArrowVegaLiteChart,
  scriptRunId = NO_SCRIPT_RUN_ID
): ElementNode {
  const element = makeProto(Element, { arrowVegaLiteChart: data })
  return new ElementNode(element, ForwardMsgMetadata.create(), scriptRunId)
}

/** Create a ForwardMsgMetadata with the given container and path */
function forwardMsgMetadata(deltaPath: number[]): ForwardMsgMetadata {
  expect(deltaPath.length).toBeGreaterThanOrEqual(2)
  return makeProto(ForwardMsgMetadata, { deltaPath })
}

/**
 * Make a "fully concrete" instance of a protobuf message.
 * This function constructs a message and then encodes and decodes it as
 * if it had arrived on the wire. This ensures that that it has all its
 * 'oneOfs' and 'defaults' set.
 */
function makeProto<Type, Props>(
  MessageType: {
    new (props: Props): Type
    encode: (message: Type, writer: Writer) => Writer
    decode: (bytes: Uint8Array) => Type
  },
  properties: Props
): Type {
  const message = new MessageType(properties)
  const bytes = MessageType.encode(message, Writer.create()).finish()
  return MessageType.decode(bytes)
}

// Custom Jest matchers for dealing with AppNodes
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeTextNode(text: string): R
    }
  }
}

expect.extend({
  toBeTextNode(received, text): jest.CustomMatcherResult {
    const elementNode = received as ElementNode
    if (elementNode == null) {
      return {
        message: () => `expected ${received} to be an instance of ElementNode`,
        pass: false,
      }
    }

    const { type } = elementNode.element
    if (type !== "text") {
      return {
        message: () =>
          `expected ${received}.element.type to be 'text', but it was ${type}`,
        pass: false,
      }
    }

    const textBody = elementNode.element.text?.body
    return {
      message: () =>
        `expected ${received}.element.text.body to be "${text}", but it was "${textBody}"`,
      pass: textBody === text,
    }
  },
})
