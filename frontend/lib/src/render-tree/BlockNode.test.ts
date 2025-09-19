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

import { block, text } from "./test-utils"
import { ElementsSetVisitor } from "./visitors/ElementsSetVisitor"
import { GetNodeByDeltaPathVisitor } from "./visitors/GetNodeByDeltaPathVisitor"

// prettier-ignore
const BLOCK = block([
  text("1"),
  block([
    text("2"),
  ]),
])

describe("AppNode.getIn", () => {
  it("handles shallow paths", () => {
    const node = GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [0])
    expect(node).toBeTextNode("1")
  })

  it("handles deep paths", () => {
    const node = GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [1, 0])
    expect(node).toBeTextNode("2")
  })

  it("returns undefined for invalid paths", () => {
    const node = GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [2, 3, 4])
    expect(node).toBeUndefined()
  })
})

describe("BlockNode.visit", () => {
  it("calls visitBlockNode on the visitor", () => {
    const node = block([text("child1"), text("child2")])
    const mockVisitor = {
      visitElementNode: vi.fn().mockReturnValue("element-result"),
      visitBlockNode: vi.fn().mockReturnValue("block-result"),
    }

    const result = node.accept(mockVisitor)

    expect(mockVisitor.visitBlockNode).toHaveBeenCalledWith(node)
    expect(mockVisitor.visitElementNode).not.toHaveBeenCalled()
    expect(result).toEqual("block-result")
  })

  it("allows visitor to return the same node", () => {
    const node = block([text("child")])
    const identityVisitor = {
      visitElementNode: vi.fn(),
      visitBlockNode: vi.fn().mockReturnValue(node),
    }

    const result = node.accept(identityVisitor)

    expect(result).toBe(node)
  })

  it("allows visitor to return undefined", () => {
    const node = block([text("child")])
    const nullVisitor = {
      visitElementNode: vi.fn(),
      visitBlockNode: vi.fn().mockReturnValue(undefined),
    }

    const result = node.accept(nullVisitor)

    expect(result).toBeUndefined()
  })

  it("can return a modified BlockNode through visitor", () => {
    const originalNode = block([text("child1"), text("child2")])
    const transformVisitor = {
      visitElementNode: vi.fn(),
      visitBlockNode: vi.fn().mockReturnValue(block([text("transformed")])),
    }

    const result = originalNode.accept(transformVisitor)

    expect(result).not.toBe(originalNode)
    expect(result.children).toHaveLength(1)
    expect(GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])).toBeTextNode(
      "transformed"
    )
  })
})

describe("BlockNode with ElementsSetVisitor", () => {
  it("can be visited by ElementsSetVisitor to collect elements", () => {
    const child1 = text("child1")
    const child2 = text("child2")
    const node = block([child1, child2])
    const visitor = new ElementsSetVisitor()

    const result = node.accept(visitor)

    expect(result.size).toBe(2)
    expect(result.has(child1.element)).toBe(true)
    expect(result.has(child2.element)).toBe(true)
    expect(visitor.elements.size).toBe(2)
    expect(visitor.elements.has(child1.element)).toBe(true)
    expect(visitor.elements.has(child2.element)).toBe(true)
  })

  it("works with ElementsSetVisitor static method", () => {
    const child1 = text("child1")
    const child2 = text("child2")
    const node = block([child1, child2])

    const elements = ElementsSetVisitor.collectElements(node)

    expect(elements.size).toBe(2)
    expect(elements.has(child1.element)).toBe(true)
    expect(elements.has(child2.element)).toBe(true)
  })

  it("handles nested blocks with ElementsSetVisitor", () => {
    const innerElement = text("inner")
    const outerElement = text("outer")
    const innerBlock = block([innerElement])
    const outerBlock = block([outerElement, innerBlock])

    const elements = ElementsSetVisitor.collectElements(outerBlock)

    expect(elements.size).toBe(2)
    expect(elements.has(innerElement.element)).toBe(true)
    expect(elements.has(outerElement.element)).toBe(true)
  })
})
