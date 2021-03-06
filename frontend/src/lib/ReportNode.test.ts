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

import {
  Block as BlockProto,
  Delta as DeltaProto,
  Element,
  ForwardMsgMetadata,
  NamedDataSet,
} from "autogen/proto"
import mockDataFrameData from "components/elements/DataFrame/mock"
import { Writer } from "protobufjs"
import { addRows } from "./dataFrameProto"
import { toImmutableProto } from "./immutableProto"
import { BlockNode, ElementNode, ReportNode, ReportRoot } from "./ReportNode"

const NO_REPORT_ID = "NO_REPORT_ID"

// prettier-ignore
const BLOCK = block([
  text("1"),
  block([
    text("2"),
  ]),
])

const ROOT = new ReportRoot(new BlockNode([BLOCK, new BlockNode()]))

describe("ReportNode.getIn", () => {
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

describe("ReportNode.setIn", () => {
  it("handles shallow paths", () => {
    const newBlock = BLOCK.setIn([0], text("new"), NO_REPORT_ID)
    expect(newBlock.getIn([0])).toBeTextNode("new")

    // Check BLOCK..newBlock diff is as expected.
    expect(newBlock).not.toStrictEqual(BLOCK)
    expect(newBlock.getIn([1])).toStrictEqual(BLOCK.getIn([1]))
  })

  it("handles deep paths", () => {
    const newBlock = BLOCK.setIn([1, 1], text("new"), NO_REPORT_ID)
    expect(newBlock.getIn([1, 1])).toBeTextNode("new")

    // Check BLOCK..newBlock diff is as expected
    expect(newBlock).not.toStrictEqual(BLOCK)
    expect(newBlock.getIn([0])).toStrictEqual(BLOCK.getIn([0]))
    expect(newBlock.getIn([1])).not.toStrictEqual(BLOCK.getIn([1]))
    expect(newBlock.getIn([1, 0])).toStrictEqual(BLOCK.getIn([1, 0]))
    expect(newBlock.getIn([1, 1])).not.toStrictEqual(BLOCK.getIn([1, 1]))
  })

  it("throws an error for invalid paths", () => {
    expect(() => BLOCK.setIn([1, 2], text("new"), NO_REPORT_ID)).toThrow(
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

describe("ReportRoot.empty", () => {
  it("creates an empty tree", () => {
    const empty = ReportRoot.empty()
    expect(empty.main.isEmpty).toBe(true)
    expect(empty.sidebar.isEmpty).toBe(true)
  })

  it("creates placeholder alert", () => {
    const empty = ReportRoot.empty("placeholder text!")

    expect(empty.main.children.length).toBe(1)
    const child = empty.main.getIn([0]) as ElementNode
    expect(child.element.alert?.body).toBe("placeholder text!")

    expect(empty.sidebar.isEmpty).toBe(true)
  })
})

describe("ReportRoot.applyDelta", () => {
  it("handles 'newElement' deltas", () => {
    const delta = makeProto(DeltaProto, {
      newElement: { text: { body: "newElement!" } },
    })
    const newRoot = ROOT.applyDelta(
      "new_report_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    )

    const newNode = newRoot.main.getIn([1, 1]) as ElementNode
    expect(newNode).toBeTextNode("newElement!")

    // Check that our new reportID has been set only on the touched nodes
    expect(newRoot.main.reportId).toBe("new_report_id")
    expect(newRoot.main.getIn([0])?.reportId).toBe(NO_REPORT_ID)
    expect(newRoot.main.getIn([1])?.reportId).toBe("new_report_id")
    expect(newRoot.main.getIn([1, 0])?.reportId).toBe(NO_REPORT_ID)
    expect(newRoot.main.getIn([1, 1])?.reportId).toBe("new_report_id")
    expect(newRoot.sidebar.reportId).toBe(NO_REPORT_ID)
  })

  it("handles 'addBlock' deltas", () => {
    const delta = makeProto(DeltaProto, { addBlock: {} })
    const newRoot = ROOT.applyDelta(
      "new_report_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    )

    const newNode = newRoot.main.getIn([1, 1]) as BlockNode
    expect(newNode).toBeDefined()

    // Check that our new reportID has been set only on the touched nodes
    expect(newRoot.main.reportId).toBe("new_report_id")
    expect(newRoot.main.getIn([0])?.reportId).toBe(NO_REPORT_ID)
    expect(newRoot.main.getIn([1])?.reportId).toBe("new_report_id")
    expect(newRoot.main.getIn([1, 0])?.reportId).toBe(NO_REPORT_ID)
    expect(newRoot.main.getIn([1, 1])?.reportId).toBe("new_report_id")
    expect(newRoot.sidebar.reportId).toBe(NO_REPORT_ID)
  })

  const addRowsTypes = ["dataFrame", "table", "vegaLiteChart"]
  it.each(addRowsTypes)("handles 'addRows' for %s", elementType => {
    // Create a report with a dataframe node
    const root = ReportRoot.empty().applyDelta(
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
    expect(addRowsElement.reportId).toBe("postAddRows")
    expect(addRowsElement.immutableElement).toEqual(expectedData)
  })
})

describe("ReportRoot.clearStaleNodes", () => {
  it("clears stale nodes", () => {
    // Add a new element and clear stale nodes
    const delta = makeProto(DeltaProto, {
      newElement: { text: { body: "newElement!" } },
    })
    const newRoot = ROOT.applyDelta(
      "new_report_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    ).clearStaleNodes("new_report_id")

    // We should now only have a single element, inside a single block
    expect(newRoot.main.getIn([0, 0])).toBeTextNode("newElement!")
    expect(newRoot.getElements().size).toBe(1)
  })

  it("handles `allowEmpty` blocks correctly", () => {
    // Create a tree with two blocks, one with allowEmpty: true, and the other
    // with allowEmpty: false
    const newRoot = ReportRoot.empty()
      .applyDelta(
        "new_report_id",
        makeProto(DeltaProto, { addBlock: { allowEmpty: true } }),
        forwardMsgMetadata([0, 0])
      )
      .applyDelta(
        "new_report_id",
        makeProto(DeltaProto, { addBlock: { allowEmpty: false } }),
        forwardMsgMetadata([0, 1])
      )

    expect(newRoot.main.getIn([0])).toBeInstanceOf(BlockNode)
    expect(newRoot.main.getIn([1])).toBeInstanceOf(BlockNode)

    // Prune nodes. Only the `allowEmpty` node should remain.
    const pruned = newRoot.clearStaleNodes("new_report_id")
    expect(pruned.main.getIn([0])).toBeInstanceOf(BlockNode)
    expect(pruned.main.getIn([1])).not.toBeDefined()
  })
})

describe("ReportRoot.getElements", () => {
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
function text(text: string, reportId = NO_REPORT_ID): ElementNode {
  const element = makeProto(Element, { text: { body: text } })
  return new ElementNode(element, ForwardMsgMetadata.create(), reportId)
}

/** Create a BlockNode with the given properties. */
function block(
  children: ReportNode[] = [],
  reportId = NO_REPORT_ID
): BlockNode {
  return new BlockNode(children, makeProto(BlockProto, {}), reportId)
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

// Custom Jest matchers for dealing with ReportNodes
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
