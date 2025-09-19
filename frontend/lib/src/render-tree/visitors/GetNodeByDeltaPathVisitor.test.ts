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
  describe("constructor", () => {
    it("creates visitor with valid parameters", () => {
      const visitor = new GetNodeByDeltaPathVisitor([0, 1])
      expect(visitor).toBeDefined()
    })

    it("creates visitor with empty path", () => {
      const visitor = new GetNodeByDeltaPathVisitor([])
      expect(visitor).toBeDefined()
    })
  })

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
  })

  describe("recursive behavior", () => {
    it("creates new visitor instances for recursive calls", () => {
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

    it("returns undefined for invalid deep path", () => {
      const deepBlock = block([
        text("level1"),
        block([text("level2-0"), text("level2-1")]),
      ])

      const visitor = new GetNodeByDeltaPathVisitor([1, 2, 0])
      const result = visitor.visitBlockNode(deepBlock)

      expect(result).toBeUndefined()
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

    it("creates new visitor instance for each static call", () => {
      const result1 = GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [0])
      const result2 = GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [1, 0])

      expect(result1).toBeTextNode("1")
      expect(result2).toBeTextNode("2")
      expect(result1).not.toBe(result2)
    })

    it("handles empty path with static method", () => {
      const result = GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [])

      expect(result).toBeUndefined()
    })
  })

  describe("edge cases", () => {
    it("handles single-element block", () => {
      const singleElementBlock = block([text("only")])
      const visitor = new GetNodeByDeltaPathVisitor([0])
      const result = visitor.visitBlockNode(singleElementBlock)

      expect(result).toBeTextNode("only")
    })

    it("handles complex mixed node types", () => {
      const mixedBlock = block([
        text("text_element"),
        block([text("nested_text")]),
        text("another_text"),
      ])

      // Get the nested block
      const visitor1 = new GetNodeByDeltaPathVisitor([1])
      const result1 = visitor1.visitBlockNode(mixedBlock)
      expect(result1).toBeInstanceOf(BlockNode)

      // Get element inside nested block
      const visitor2 = new GetNodeByDeltaPathVisitor([1, 0])
      const result2 = visitor2.visitBlockNode(mixedBlock)
      expect(result2).toBeTextNode("nested_text")

      // Get direct text elements
      const visitor3 = new GetNodeByDeltaPathVisitor([0])
      const result3 = visitor3.visitBlockNode(mixedBlock)
      expect(result3).toBeTextNode("text_element")

      const visitor4 = new GetNodeByDeltaPathVisitor([2])
      const result4 = visitor4.visitBlockNode(mixedBlock)
      expect(result4).toBeTextNode("another_text")
    })

    it("handles multiple levels of BlockNodes", () => {
      const multiLevelBlock = block([
        text("first"),
        block([
          text("second_first"),
          block([text("third_first"), text("third_second")]),
          text("second_second"),
        ]),
        text("first_second"),
      ])

      // Test various paths
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(multiLevelBlock, [0])
      ).toBeTextNode("first")

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(multiLevelBlock, [1, 0])
      ).toBeTextNode("second_first")

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(multiLevelBlock, [1, 1, 0])
      ).toBeTextNode("third_first")

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(multiLevelBlock, [1, 1, 1])
      ).toBeTextNode("third_second")

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(multiLevelBlock, [1, 2])
      ).toBeTextNode("second_second")

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(multiLevelBlock, [2])
      ).toBeTextNode("first_second")
    })

    it("returns correct BlockNode structure when getting intermediate node", () => {
      const testBlock = block([
        text("root_text"),
        block([text("child1"), text("child2")]),
      ])

      const result = GetNodeByDeltaPathVisitor.getNodeAtPath(testBlock, [1])

      expect(result).toBeInstanceOf(BlockNode)
      const blockResult = result as BlockNode
      expect(blockResult.children).toHaveLength(2)
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(blockResult, [0])
      ).toBeTextNode("child1")
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(blockResult, [1])
      ).toBeTextNode("child2")
    })
  })

  describe("integration with different block structures", () => {
    it("works with block structure from BlockNode tests", () => {
      // This is the structure used in BlockNode.test.ts
      const blockNodeTestStructure = block([
        text("1"),
        block([
          text("2"), // Only one child in nested block
        ]),
      ])

      // Test shallow path
      const shallowResult = GetNodeByDeltaPathVisitor.getNodeAtPath(
        blockNodeTestStructure,
        [0]
      )
      expect(shallowResult).toBeTextNode("1")

      // Test deep path - this block structure has only 1 child in nested block
      const deepResult = GetNodeByDeltaPathVisitor.getNodeAtPath(
        blockNodeTestStructure,
        [1, 0]
      )
      expect(deepResult).toBeTextNode("2")

      // Test invalid path - trying to get at index 1 in nested block that has only 1 child (index 0)
      const invalidResult = GetNodeByDeltaPathVisitor.getNodeAtPath(
        blockNodeTestStructure,
        [1, 1]
      )
      expect(invalidResult).toBeUndefined()
    })

    it("maintains consistency with original getIn behavior", () => {
      // Test various scenarios that the original getIn method handled
      const testStructure = block([
        text("elem0"),
        block([text("elem1_0"), text("elem1_1")]),
        text("elem2"),
      ])

      // Valid paths
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(testStructure, [0])
      ).toBeTextNode("elem0")

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(testStructure, [1, 0])
      ).toBeTextNode("elem1_0")

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(testStructure, [1, 1])
      ).toBeTextNode("elem1_1")

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(testStructure, [2])
      ).toBeTextNode("elem2")

      // Invalid paths should return undefined
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(testStructure, [])
      ).toBeUndefined()

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(testStructure, [3])
      ).toBeUndefined()

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(testStructure, [-1])
      ).toBeUndefined()

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(testStructure, [1, 2])
      ).toBeUndefined()

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(testStructure, [2, 3, 4])
      ).toBeUndefined()
    })
  })
})
