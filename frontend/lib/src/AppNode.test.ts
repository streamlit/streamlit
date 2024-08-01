/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { Writer } from "protobufjs"
import { vectorFromArray } from "apache-arrow"

import { isNullOrUndefined } from "@streamlit/lib/src/util/utils"

import {
  ArrowNamedDataSet,
  Block as BlockProto,
  Delta as DeltaProto,
  Element,
  ForwardMsgMetadata,
  IArrowVegaLiteChart,
} from "./proto"
import { AppNode, AppRoot, BlockNode, ElementNode } from "./AppNode"
import { IndexTypeName } from "./dataframes/Quiver"
import { UNICODE } from "./mocks/arrow"

const NO_SCRIPT_RUN_ID = "NO_SCRIPT_RUN_ID"
const FAKE_SCRIPT_HASH = "fake_script_hash"
// prettier-ignore
const BLOCK = block([
  text("1"),
  block([
    text("2"),
  ]),
])

// Initialize new AppRoot with a main block node and three child block nodes - sidebar, events and bottom.
const ROOT = new AppRoot(
  FAKE_SCRIPT_HASH,
  new BlockNode(FAKE_SCRIPT_HASH, [
    BLOCK,
    new BlockNode(FAKE_SCRIPT_HASH),
    new BlockNode(FAKE_SCRIPT_HASH),
    new BlockNode(FAKE_SCRIPT_HASH),
  ])
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
  let windowSpy: jest.SpyInstance

  beforeEach(() => {
    windowSpy = jest.spyOn(window, "window", "get")
  })

  afterEach(() => {
    windowSpy.mockRestore()
  })

  it("creates empty tree except for a skeleton", async () => {
    const empty = AppRoot.empty(FAKE_SCRIPT_HASH)

    // The linter is misfiring here. We're not accessing a DOM node.
    // eslint-disable-next-line testing-library/no-node-access
    expect(empty.main.children.length).toBe(1)
    const child = empty.main.getIn([0]) as ElementNode
    expect(child.element.skeleton).not.toBeNull()

    expect(empty.sidebar.isEmpty).toBe(true)
  })

  it("sets the main script hash and active script hash", () => {
    const empty = AppRoot.empty(FAKE_SCRIPT_HASH)

    expect(empty.mainScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(empty.main.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(empty.sidebar.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(empty.event.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(empty.bottom.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(empty.root.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
  })

  it("creates empty tree with no loading screen if query param is set", async () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed_options=hide_loading_screen",
      },
    }))

    const empty = AppRoot.empty(FAKE_SCRIPT_HASH)

    expect(empty.main.isEmpty).toBe(true)
    expect(empty.sidebar.isEmpty).toBe(true)
  })

  it("creates empty tree with v1 loading screen if query param is set", async () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed_options=show_loading_screen_v1",
      },
    }))

    const empty = AppRoot.empty(FAKE_SCRIPT_HASH)

    // The linter is misfiring here. We're not accessing a DOM node.
    // eslint-disable-next-line testing-library/no-node-access
    expect(empty.main.children.length).toBe(1)
    const child = empty.main.getIn([0]) as ElementNode
    expect(child.element.alert).toBeDefined()

    expect(empty.sidebar.isEmpty).toBe(true)
  })

  it("creates empty tree with v2 loading screen if query param is set", async () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed_options=show_loading_screen_v2",
      },
    }))

    const empty = AppRoot.empty(FAKE_SCRIPT_HASH)

    // The linter is misfiring here. We're not accessing a DOM node.
    // eslint-disable-next-line testing-library/no-node-access
    expect(empty.main.children.length).toBe(1)
    const child = empty.main.getIn([0]) as ElementNode
    expect(child.element.skeleton).not.toBeNull()

    expect(empty.sidebar.isEmpty).toBe(true)
  })

  it("creates empty tree with no loading screen if query param is v1 and it's not first load", async () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "?embed_options=show_loading_screen_v1",
      },
    }))

    const empty = AppRoot.empty(FAKE_SCRIPT_HASH, false)

    expect(empty.main.isEmpty).toBe(true)
    expect(empty.sidebar.isEmpty).toBe(true)
  })
})

describe("AppRoot.filterMainScriptElements", () => {
  it("does not clear nodes associated with main script hash", () => {
    // Add a new element and clear stale nodes
    const delta = makeProto(DeltaProto, {
      newElement: { text: { body: "newElement!" } },
    })
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    ).filterMainScriptElements(FAKE_SCRIPT_HASH)

    // We should now only have a single element, inside a single block
    expect(newRoot.main.getIn([1, 1])).toBeTextNode("newElement!")
    expect(newRoot.getElements().size).toBe(3)
  })

  it("clears nodes not associated with main script hash", () => {
    // Add a new element and clear stale nodes
    const delta = makeProto(DeltaProto, {
      newElement: { text: { body: "newElement!" } },
    })
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1], "DIFFERENT_HASH")
    ).filterMainScriptElements(FAKE_SCRIPT_HASH)

    // We should now only have a single element, inside a single block
    expect(newRoot.main.getIn([1, 1])).toBeUndefined()
    expect(newRoot.getElements().size).toBe(2)
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
    expect(newRoot.main.fragmentId).toBe(undefined)
    expect(newRoot.main.getIn([0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
    expect(newRoot.main.getIn([1])?.scriptRunId).toBe("new_session_id")
    expect(newRoot.main.getIn([1, 0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
    expect(newRoot.main.getIn([1, 1])?.scriptRunId).toBe("new_session_id")
    expect(newNode.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
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
    expect(newRoot.main.fragmentId).toBe(undefined)
    expect(newRoot.main.getIn([0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
    expect(newRoot.main.getIn([1])?.scriptRunId).toBe("new_session_id")
    expect(newRoot.main.getIn([1, 0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
    expect(newRoot.main.getIn([1, 1])?.scriptRunId).toBe("new_session_id")
    expect(newNode.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(newRoot.sidebar.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
  })

  it("specifies active script hash on 'newElement' deltas", () => {
    const delta = makeProto(DeltaProto, {
      newElement: { text: { body: "newElement!" } },
    })
    const NEW_FAKE_SCRIPT_HASH = "new_fake_script_hash"
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1], NEW_FAKE_SCRIPT_HASH)
    )

    const newNode = newRoot.main.getIn([1, 1]) as ElementNode
    expect(newNode).toBeDefined()

    // Check that our new other nodes are not affected by the new script hash
    expect(newRoot.main.getIn([1, 0])?.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(newNode.activeScriptHash).toBe(NEW_FAKE_SCRIPT_HASH)
  })

  it("specifies active script hash on 'addBlock' deltas", () => {
    const delta = makeProto(DeltaProto, { addBlock: {} })
    const NEW_FAKE_SCRIPT_HASH = "new_fake_script_hash"
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1], NEW_FAKE_SCRIPT_HASH)
    )

    const newNode = newRoot.main.getIn([1, 1]) as BlockNode
    expect(newNode).toBeDefined()

    // Check that our new scriptRunId has been set only on the touched nodes
    expect(newRoot.main.getIn([1, 0])?.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(newNode.activeScriptHash).toBe(NEW_FAKE_SCRIPT_HASH)
  })

  it("can set fragmentId in 'newElement' deltas", () => {
    const delta = makeProto(DeltaProto, {
      newElement: { text: { body: "newElement!" } },
      fragmentId: "myFragmentId",
    })
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    )

    const newNode = newRoot.main.getIn([1, 1]) as ElementNode
    expect(newNode.fragmentId).toBe("myFragmentId")
  })

  it("can set fragmentId in 'addBlock' deltas", () => {
    const delta = makeProto(DeltaProto, {
      addBlock: {},
      fragmentId: "myFragmentId",
    })
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    )

    const newNode = newRoot.main.getIn([1, 1]) as BlockNode
    expect(newNode.fragmentId).toBe("myFragmentId")
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
    ).clearStaleNodes("new_session_id", [])

    // We should now only have a single element, inside a single block
    expect(newRoot.main.getIn([0, 0])).toBeTextNode("newElement!")
    expect(newRoot.getElements().size).toBe(1)
  })

  it("handles currentFragmentId correctly", () => {
    const root = AppRoot.empty(FAKE_SCRIPT_HASH)
      // Block not corresponding to my_fragment_id. Should be preserved.
      .applyDelta(
        "old_session_id",
        makeProto(DeltaProto, { addBlock: { allowEmpty: true } }),
        forwardMsgMetadata([0, 0])
      )
      // Element in block unrelated to my_fragment_id. Should be preserved.
      .applyDelta(
        "old_session_id",
        makeProto(DeltaProto, {
          newElement: { text: { body: "oldElement!" } },
        }),
        forwardMsgMetadata([0, 0, 0])
      )
      // Another element in block unrelated to my_fragment_id. Should be preserved.
      .applyDelta(
        "old_session_id",
        makeProto(DeltaProto, {
          newElement: { text: { body: "oldElement2!" } },
          fragmentId: "other_fragment_id",
        }),
        forwardMsgMetadata([0, 0, 1])
      )
      // Old element related to my_fragment_id but in an unrelated block. Should be preserved.
      .applyDelta(
        "old_session_id",
        makeProto(DeltaProto, {
          newElement: { text: { body: "oldElement4!" } },
          fragmentId: "my_fragment_id",
        }),
        forwardMsgMetadata([0, 0, 2])
      )
      // Block corresponding to my_fragment_id
      .applyDelta(
        "new_session_id",
        makeProto(DeltaProto, {
          addBlock: { allowEmpty: false },
          fragmentId: "my_fragment_id",
        }),
        forwardMsgMetadata([0, 1])
      )
      // Old element related to my_fragment_id. Should be pruned.
      .applyDelta(
        "old_session_id",
        makeProto(DeltaProto, {
          newElement: { text: { body: "oldElement3!" } },
          fragmentId: "my_fragment_id",
        }),
        forwardMsgMetadata([0, 1, 0])
      )
      // New element related to my_fragment_id. Should be preserved.
      .applyDelta(
        "new_session_id",
        makeProto(DeltaProto, {
          newElement: { text: { body: "newElement!" } },
          fragmentId: "my_fragment_id",
        }),
        forwardMsgMetadata([0, 1, 1])
      )

    const pruned = root.clearStaleNodes("new_session_id", ["my_fragment_id"])

    expect(pruned.main.getIn([0])).toBeInstanceOf(BlockNode)
    expect((pruned.main.getIn([0]) as BlockNode).children).toHaveLength(3)
    expect(pruned.main.getIn([0, 0])).toBeTextNode("oldElement!")
    expect(pruned.main.getIn([0, 1])).toBeTextNode("oldElement2!")
    expect(pruned.main.getIn([0, 2])).toBeTextNode("oldElement4!")

    expect(pruned.main.getIn([1])).toBeInstanceOf(BlockNode)
    expect((pruned.main.getIn([1]) as BlockNode).children).toHaveLength(1)
    expect(pruned.main.getIn([1, 0])).toBeTextNode("newElement!")
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
  return new ElementNode(
    element,
    ForwardMsgMetadata.create(),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
}

/** Create a BlockNode with the given properties. */
function block(
  children: AppNode[] = [],
  scriptRunId = NO_SCRIPT_RUN_ID
): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    makeProto(BlockProto, {}),
    scriptRunId
  )
}

/** Create an arrowTable element node with the given properties. */
function arrowTable(scriptRunId = NO_SCRIPT_RUN_ID): ElementNode {
  const element = makeProto(Element, { arrowTable: { data: UNICODE } })
  return new ElementNode(
    element,
    ForwardMsgMetadata.create(),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
}

/** Create an arrowDataFrame element node with the given properties. */
function arrowDataFrame(scriptRunId = NO_SCRIPT_RUN_ID): ElementNode {
  const element = makeProto(Element, { arrowDataFrame: { data: UNICODE } })
  return new ElementNode(
    element,
    ForwardMsgMetadata.create(),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
}

/** Create an arrowVegaLiteChart element node with the given properties. */
function arrowVegaLiteChart(
  data: IArrowVegaLiteChart,
  scriptRunId = NO_SCRIPT_RUN_ID
): ElementNode {
  const element = makeProto(Element, { arrowVegaLiteChart: data })
  return new ElementNode(
    element,
    ForwardMsgMetadata.create(),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
}

/** Create a ForwardMsgMetadata with the given container and path */
function forwardMsgMetadata(
  deltaPath: number[],
  activeScriptHash = FAKE_SCRIPT_HASH
): ForwardMsgMetadata {
  expect(deltaPath.length).toBeGreaterThanOrEqual(2)
  return makeProto(ForwardMsgMetadata, { deltaPath, activeScriptHash })
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
    if (isNullOrUndefined(elementNode)) {
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
