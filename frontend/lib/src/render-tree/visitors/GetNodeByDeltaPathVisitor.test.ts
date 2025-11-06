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

import { BlockNode } from "~lib/render-tree/BlockNode"
import { block, text } from "~lib/render-tree/test-utils"

import { GetNodeByDeltaPathVisitor } from "./GetNodeByDeltaPathVisitor"

// Test data setup following the existing pattern
const BLOCK = block([text("1"), block([text("2"), text("3")])])

describe("GetNodeByDeltaPathVisitor", () => {
  describe("visitElementNode", () => {
    it("always returns undefined for ElementNode", () => {
      const elementNode = text("element")
      const visitor = new GetNodeByDeltaPathVisitor([0])

      const result = visitor.visitElementNode(elementNode)

      expect(result).toBeUndefined()
    })

    it("returns undefined for ElementNode even with empty path", () => {
      const elementNode = text("element")
      const visitor = new GetNodeByDeltaPathVisitor([])

      const result = visitor.visitElementNode(elementNode)

      expect(result).toBeUndefined()
    })
  })

  describe("visitBlockNode", () => {
    it("returns undefined for empty path", () => {
      const visitor = new GetNodeByDeltaPathVisitor([])
      const result = visitor.visitBlockNode(BLOCK)

      expect(result).toBeUndefined()
    })

    it("gets node at shallow path", () => {
      const visitor = new GetNodeByDeltaPathVisitor([0])
      const result = visitor.visitBlockNode(BLOCK)

      expect(result).toBeTextNode("1")
    })

    it("gets node at deep path", () => {
      const visitor = new GetNodeByDeltaPathVisitor([1, 0])
      const result = visitor.visitBlockNode(BLOCK)

      expect(result).toBeTextNode("2")
    })

    it("gets second node at deep path", () => {
      const visitor = new GetNodeByDeltaPathVisitor([1, 1])
      const result = visitor.visitBlockNode(BLOCK)

      expect(result).toBeTextNode("3")
    })

    it("returns undefined for invalid child index - negative", () => {
      const visitor = new GetNodeByDeltaPathVisitor([-1])
      const result = visitor.visitBlockNode(BLOCK)

      expect(result).toBeUndefined()
    })

    it("returns undefined for invalid child index - too large", () => {
      const visitor = new GetNodeByDeltaPathVisitor([3])
      const result = visitor.visitBlockNode(BLOCK)

      expect(result).toBeUndefined()
    })

    it("returns undefined for invalid deep path", () => {
      const visitor = new GetNodeByDeltaPathVisitor([1, 3])
      const result = visitor.visitBlockNode(BLOCK)

      expect(result).toBeUndefined()
    })

    it("handles boundary index (exact length)", () => {
      const visitor = new GetNodeByDeltaPathVisitor([2])
      const result = visitor.visitBlockNode(BLOCK)

      expect(result).toBeUndefined()
    })

    it("works with empty block", () => {
      const emptyBlock = new BlockNode("script_hash", [])
      const visitor = new GetNodeByDeltaPathVisitor([0])
      const result = visitor.visitBlockNode(emptyBlock)

      expect(result).toBeUndefined()
    })

    it("returns a block node if needed", () => {
      // Create a deeper structure
      const deepBlock = block([
        text("level1"),
        block([text("level2-0"), block([text("level3-0"), text("level3-1")])]),
      ])

      const visitor = new GetNodeByDeltaPathVisitor([1, 1, 0])
      const result = visitor.visitBlockNode(deepBlock)

      expect(result).toBeTextNode("level3-0")
    })

    it("handles deep path traversal", () => {
      const deepBlock = block([
        text("level1"),
        block([text("level2-0"), block([text("level3-0"), text("level3-1")])]),
      ])

      const visitor = new GetNodeByDeltaPathVisitor([1, 1, 1])
      const result = visitor.visitBlockNode(deepBlock)

      expect(result).toBeTextNode("level3-1")
    })

    it("handles very deep nested structure", () => {
      const veryDeepBlock = block([
        block([block([block([text("very-deep")])])]),
      ])

      const visitor = new GetNodeByDeltaPathVisitor([0, 0, 0, 0])
      const result = visitor.visitBlockNode(veryDeepBlock)

      expect(result).toBeTextNode("very-deep")
    })
  })

  describe("static getNodeAtPath", () => {
    it("gets node using static method with shallow path", () => {
      const result = GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [0])

      expect(result).toBeTextNode("1")
    })

    it("gets node using static method with deep path", () => {
      const result = GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [1, 1])

      expect(result).toBeTextNode("3")
    })

    it("returns undefined using static method for invalid path", () => {
      const result = GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [2, 3, 4])

      expect(result).toBeUndefined()
    })

    it("returns undefined when used on ElementNode via static method", () => {
      const element = text("element")
      const result = GetNodeByDeltaPathVisitor.getNodeAtPath(element, [0])

      expect(result).toBeUndefined()
    })

    it("handles empty path with static method", () => {
      const result = GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [])

      expect(result).toBeUndefined()
    })
  })
})
