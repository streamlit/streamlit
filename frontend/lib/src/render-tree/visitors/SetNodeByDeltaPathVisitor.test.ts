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

import { BlockNode } from "~lib/render-tree/BlockNode"
import { block, text } from "~lib/render-tree/test-utils"
import { TransientNode } from "~lib/render-tree/TransientNode"

import { GetNodeByDeltaPathVisitor } from "./GetNodeByDeltaPathVisitor"
import { SetNodeByDeltaPathVisitor } from "./SetNodeByDeltaPathVisitor"

// Test data setup following the existing pattern
const BLOCK = block([text("1"), block([text("2"), text("3")])])

describe("SetNodeByDeltaPathVisitor", () => {
  describe("constructor", () => {
    it("creates visitor with valid parameters", () => {
      const nodeToSet = text("new")
      const visitor = new SetNodeByDeltaPathVisitor(
        [0, 1],
        nodeToSet,
        "test_run_id"
      )
      expect(visitor).toBeDefined()
    })
  })

  describe("visitElementNode", () => {
    it("throws error when trying to set on ElementNode", () => {
      const elementNode = text("element")
      const nodeToSet = text("new")
      const visitor = new SetNodeByDeltaPathVisitor(
        [0],
        nodeToSet,
        "test_run_id"
      )

      expect(() => visitor.visitElementNode(elementNode)).toThrow(
        "'setIn' cannot be called on an ElementNode"
      )
    })

    it("replaces element when delta path is empty", () => {
      const elementNode = text("element")
      const nodeToSet = text("new")
      const visitor = new SetNodeByDeltaPathVisitor(
        [],
        nodeToSet,
        "test_run_id"
      )

      expect(visitor.visitElementNode(elementNode)).toBe(nodeToSet)
    })

    it("wraps element node as anchor when setting TransientNode without anchor", () => {
      const elementNode = text("element")
      const transientNode = new TransientNode(
        "run_id",
        undefined, // No anchor provided
        [text("t1")],
        123
      )
      const visitor = new SetNodeByDeltaPathVisitor(
        [],
        transientNode,
        "run_id"
      )

      // Should wrap elementNode as the anchor
      const result = visitor.visitElementNode(elementNode) as TransientNode
      expect(result).toBeInstanceOf(TransientNode)
      expect(result.anchor).toBe(elementNode)
      expect(result.transientNodes).toEqual(transientNode.transientNodes)
    })
  })

  describe("visitBlockNode", () => {
    it("sets node at shallow path", () => {
      const nodeToSet = text("new")
      const visitor = new SetNodeByDeltaPathVisitor(
        [0],
        nodeToSet,
        "test_run_id"
      )
      const result = visitor.visitBlockNode(BLOCK) as BlockNode

      expect(result).toBeInstanceOf(BlockNode)
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])
      ).toBeTextNode("new")
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1])
      ).toStrictEqual(GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [1]))
      expect(result).not.toStrictEqual(BLOCK)
    })

    it("sets node at deep path", () => {
      const nodeToSet = text("new")
      const visitor = new SetNodeByDeltaPathVisitor(
        [1, 1],
        nodeToSet,
        "test_run_id"
      )
      const result = visitor.visitBlockNode(BLOCK) as BlockNode

      expect(result).toBeInstanceOf(BlockNode)
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1, 1])
      ).toBeTextNode("new")
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])
      ).toStrictEqual(GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [0]))
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1, 0])
      ).toStrictEqual(GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [1, 0]))
      expect(result).not.toStrictEqual(BLOCK)
    })

    it.each([
      {
        description: "negative index",
        deltaPath: [-1],
        expectedError: "Bad delta path index -1 (should be between [0, 2])",
      },
      {
        description: "too large index",
        deltaPath: [3],
        expectedError: "Bad delta path index 3 (should be between [0, 2])",
      },
      {
        description: "invalid deep path",
        deltaPath: [1, 3],
        expectedError: "Bad delta path index 3 (should be between [0, 2])",
      },
    ])(
      "throws error for invalid child index - $description",
      ({ deltaPath, expectedError }) => {
        const nodeToSet = text("new")
        const visitor = new SetNodeByDeltaPathVisitor(
          deltaPath,
          nodeToSet,
          "test_run_id"
        )

        expect(() => visitor.visitBlockNode(BLOCK)).toThrow(expectedError)
      }
    )

    it("preserves block properties when creating new node", () => {
      const originalBlock = new BlockNode(
        "script_hash",
        [text("child")],
        block().deltaBlock,
        "original_run_id",
        "fragment_id",
        1234567890
      )

      const nodeToSet = text("new")
      const visitor = new SetNodeByDeltaPathVisitor(
        [0],
        nodeToSet,
        "new_run_id"
      )
      const result = visitor.visitBlockNode(originalBlock) as BlockNode

      expect(result.activeScriptHash).toBe("script_hash")
      expect(result.scriptRunId).toBe("new_run_id") // Should use the new scriptRunId
      expect(result.fragmentId).toBe("fragment_id")
      expect(result.deltaMsgReceivedAt).toBe(1234567890)
      expect(result.deltaBlock).toBe(originalBlock.deltaBlock)
    })

    it("works with empty block", () => {
      const emptyBlock = new BlockNode("script_hash", [])
      const nodeToSet = text("new")
      const visitor = new SetNodeByDeltaPathVisitor(
        [0],
        nodeToSet,
        "test_run_id"
      )
      const result = visitor.visitBlockNode(emptyBlock) as BlockNode

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])
      ).toBeTextNode("new")
      expect(result.children).toHaveLength(1)
    })

    it("handles setting at boundary index (length of children)", () => {
      const nodeToSet = text("appended")
      const visitor = new SetNodeByDeltaPathVisitor(
        [2],
        nodeToSet,
        "test_run_id"
      )
      const result = visitor.visitBlockNode(BLOCK) as BlockNode

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [2])
      ).toBeTextNode("appended")
      expect(result.children).toHaveLength(3)
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])
      ).toStrictEqual(GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [0]))
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1])
      ).toStrictEqual(GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [1]))
    })

    it("replaces block node with nodeToSet when delta path is empty", () => {
      const originalBlock = block([text("1")])
      const nodeToSet = text("replacement")
      const visitor = new SetNodeByDeltaPathVisitor([], nodeToSet, "run_id")

      const result = visitor.visitBlockNode(originalBlock)
      expect(result).toBe(nodeToSet)
    })

    it("inserts TransientNode before child when anchors do not match", () => {
      const childA = text("A")
      const childB = text("B")
      const blockNode = block([childA, childB])

      // TransientNode with a pre-set anchor that is DIFFERENT from childA
      const otherAnchor = text("other")
      const transientNode = new TransientNode(
        "run_id",
        otherAnchor,
        [text("t1")],
        123
      )

      const visitor = new SetNodeByDeltaPathVisitor(
        [0],
        transientNode,
        "run_id"
      )

      const result = visitor.visitBlockNode(blockNode) as BlockNode

      // Logic check: Since the returned TransientNode's anchor (otherAnchor)
      // does not match the original child (childA), it should be inserted BEFORE childA.
      expect(result.children).toHaveLength(3)
      expect(result.children[0]).toBe(transientNode) // Inserted
      expect(result.children[1]).toBe(childA) // Original preserved/shifted
      expect(result.children[2]).toBe(childB)
    })
  })

  describe("recursive behavior", () => {
    it("creates new visitor instances for recursive calls", () => {
      // Create a deeper structure
      const deepBlock = block([
        text("level1"),
        block([text("level2-0"), block([text("level3-0"), text("level3-1")])]),
      ])

      const nodeToSet = text("new_deep")
      const visitor = new SetNodeByDeltaPathVisitor(
        [1, 1, 0],
        nodeToSet,
        "test_run_id"
      )
      const result = visitor.visitBlockNode(deepBlock) as BlockNode

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1, 1, 0])
      ).toBeTextNode("new_deep")
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1, 1, 1])
      ).toStrictEqual(
        GetNodeByDeltaPathVisitor.getNodeAtPath(deepBlock, [1, 1, 1])
      )
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])
      ).toStrictEqual(GetNodeByDeltaPathVisitor.getNodeAtPath(deepBlock, [0]))
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1, 0])
      ).toStrictEqual(
        GetNodeByDeltaPathVisitor.getNodeAtPath(deepBlock, [1, 0])
      )
    })

    it("maintains immutability throughout recursive calls", () => {
      const deepBlock = block([
        text("level1"),
        block([text("level2-0"), text("level2-1")]),
      ])

      const nodeToSet = text("replaced")
      const visitor = new SetNodeByDeltaPathVisitor(
        [1, 0],
        nodeToSet,
        "test_run_id"
      )
      const result = visitor.visitBlockNode(deepBlock) as BlockNode

      // Original should be unchanged
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(deepBlock, [1, 0])
      ).toBeTextNode("level2-0")
      // Result should have the new node
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1, 0])
      ).toBeTextNode("replaced")
      // Unchanged parts should be the same reference
      expect(GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])).toBe(
        GetNodeByDeltaPathVisitor.getNodeAtPath(deepBlock, [0])
      )
      // Changed parts should be different references
      expect(GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1])).not.toBe(
        GetNodeByDeltaPathVisitor.getNodeAtPath(deepBlock, [1])
      )
    })
  })

  describe("static setNodeAtPath", () => {
    it("sets node using static method with shallow path", () => {
      const nodeToSet = text("static_new")
      const result = SetNodeByDeltaPathVisitor.setNodeAtPath(
        BLOCK,
        [0],
        nodeToSet,
        "test_run_id"
      )

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])
      ).toBeTextNode("static_new")
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1])
      ).toStrictEqual(GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [1]))
    })

    it("sets node using static method with deep path", () => {
      const nodeToSet = text("static_deep")
      const result = SetNodeByDeltaPathVisitor.setNodeAtPath(
        BLOCK,
        [1, 1],
        nodeToSet,
        "test_run_id"
      )

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1, 1])
      ).toBeTextNode("static_deep")
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])
      ).toStrictEqual(GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [0]))
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1, 0])
      ).toStrictEqual(GetNodeByDeltaPathVisitor.getNodeAtPath(BLOCK, [1, 0]))
    })

    it("throws error when used on ElementNode via static method", () => {
      const element = text("element")
      const nodeToSet = text("new")

      expect(() =>
        SetNodeByDeltaPathVisitor.setNodeAtPath(
          element,
          [0],
          nodeToSet,
          "test_run_id"
        )
      ).toThrow("'setIn' cannot be called on an ElementNode")
    })

    it("creates new visitor instance for each static call", () => {
      const nodeToSet1 = text("first")
      const nodeToSet2 = text("second")

      const result1 = SetNodeByDeltaPathVisitor.setNodeAtPath(
        BLOCK,
        [0],
        nodeToSet1,
        "run_id_1"
      )

      const result2 = SetNodeByDeltaPathVisitor.setNodeAtPath(
        BLOCK,
        [0],
        nodeToSet2,
        "run_id_2"
      )

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result1, [0])
      ).toBeTextNode("first")
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result2, [0])
      ).toBeTextNode("second")
      expect(result1).not.toBe(result2)
    })
  })

  describe("edge cases", () => {
    it("handles single-element path", () => {
      const singleElementBlock = block([text("only")])
      const nodeToSet = text("replaced")
      const visitor = new SetNodeByDeltaPathVisitor(
        [0],
        nodeToSet,
        "test_run_id"
      )
      const result = visitor.visitBlockNode(singleElementBlock) as BlockNode

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])
      ).toBeTextNode("replaced")
      expect(result.children).toHaveLength(1)
    })

    it("handles complex mixed node types", () => {
      const mixedBlock = block([
        text("text_element"),
        block([text("nested_text")]),
        text("another_text"),
      ])

      const newBlock = block([text("replacement_block_content")])
      const visitor = new SetNodeByDeltaPathVisitor(
        [1],
        newBlock,
        "test_run_id"
      )
      const result = visitor.visitBlockNode(mixedBlock) as BlockNode

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1])
      ).toBeInstanceOf(BlockNode)
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1, 0])
      ).toBeTextNode("replacement_block_content")
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [0])
      ).toStrictEqual(GetNodeByDeltaPathVisitor.getNodeAtPath(mixedBlock, [0]))
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [2])
      ).toStrictEqual(GetNodeByDeltaPathVisitor.getNodeAtPath(mixedBlock, [2]))
    })

    it("preserves all node properties during deep updates", () => {
      const deepStructure = new BlockNode(
        "root_script",
        [
          text("first"),
          new BlockNode(
            "nested_script",
            [text("nested_first"), text("nested_second")],
            block().deltaBlock,
            "nested_run_id",
            "nested_fragment",
            9876543210
          ),
        ],
        block().deltaBlock,
        "root_run_id",
        "root_fragment",
        1234567890
      )

      const nodeToSet = text("new_nested_second")
      const visitor = new SetNodeByDeltaPathVisitor(
        [1, 1],
        nodeToSet,
        "update_run_id"
      )
      const result = visitor.visitBlockNode(deepStructure) as BlockNode

      // Check that the update worked
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(result, [1, 1])
      ).toBeTextNode("new_nested_second")

      // Check that root properties are preserved except scriptRunId
      expect(result.activeScriptHash).toBe("root_script")
      expect(result.scriptRunId).toBe("update_run_id")
      expect(result.fragmentId).toBe("root_fragment")
      expect(result.deltaMsgReceivedAt).toBe(1234567890)

      // Check that nested block properties are preserved except scriptRunId
      const nestedResult = GetNodeByDeltaPathVisitor.getNodeAtPath(
        result,
        [1]
      ) as BlockNode
      expect(nestedResult.activeScriptHash).toBe("nested_script")
      expect(nestedResult.scriptRunId).toBe("update_run_id")
      expect(nestedResult.fragmentId).toBe("nested_fragment")
      expect(nestedResult.deltaMsgReceivedAt).toBe(9876543210)
    })
  })

  describe("visitTransientNode", () => {
    it("drills through anchor without consuming path index and preserves transient wrapper", () => {
      // TransientNode is transparent in delta path - it doesn't consume an index
      const inner = block([text("child")])
      const t = new TransientNode("run", inner, [text("t1")], 1)
      const nodeToSet = text("new_child")
      // Path [0] should pass through to anchor and set child at index 0
      const visitor = new SetNodeByDeltaPathVisitor([0], nodeToSet, "run")

      const result = visitor.visitTransientNode(t) as TransientNode
      // Should preserve TransientNode wrapper
      expect(result).toBeInstanceOf(TransientNode)
      expect(result.transientNodes).toEqual(t.transientNodes)
      // The anchor should be updated
      expect(result.anchor).toBeDefined()
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(
          result.anchor as BlockNode,
          [0]
        )
      ).toBeTextNode("new_child")
    })

    it("throws when drilling required but no anchor exists", () => {
      const t = new TransientNode("run", undefined, [text("t1")], 1)
      const nodeToSet = text("x")
      // Any non-empty path should require drilling through anchor
      const visitor = new SetNodeByDeltaPathVisitor([0], nodeToSet, "run")
      expect(() => visitor.visitTransientNode(t)).toThrow(
        "TransientNode has no anchor to set node at"
      )
    })

    it("delegates to nodeToSet.replaceTransientNodeWithSelf when path is empty", () => {
      const t = new TransientNode("run", text("anchor"), [text("t1")], 5)
      const nodeToSet = new BlockNode("hash", [])
      const spy = vi.spyOn(nodeToSet, "replaceTransientNodeWithSelf")
      // Empty path means we're replacing the TransientNode itself
      const visitor = new SetNodeByDeltaPathVisitor([], nodeToSet, "run")

      visitor.visitTransientNode(t)
      expect(spy).toHaveBeenCalledWith(t)
    })

    it("preserves transient nodes when setting deep inside anchor", () => {
      // Scenario: TransientNode wraps a container, and we're adding children inside
      const container = block([])
      const transientElements = [text("spinner")]
      const t = new TransientNode("run", container, transientElements, 1)

      // Add first child at path [0] (inside container)
      const column0 = block([text("col0")])
      const visitor1 = new SetNodeByDeltaPathVisitor([0], column0, "run")
      const result1 = visitor1.visitTransientNode(t) as TransientNode

      // TransientNode should be preserved
      expect(result1).toBeInstanceOf(TransientNode)
      expect(result1.transientNodes).toEqual(transientElements)

      // Container (anchor) should have the new child
      const updatedContainer = result1.anchor as BlockNode
      expect(updatedContainer.children).toHaveLength(1)

      // Add second child at path [1]
      const column1 = block([text("col1")])
      const visitor2 = new SetNodeByDeltaPathVisitor([1], column1, "run")
      const result2 = visitor2.visitTransientNode(result1) as TransientNode

      // TransientNode should still be preserved
      expect(result2).toBeInstanceOf(TransientNode)
      expect(result2.transientNodes).toEqual(transientElements)

      // Container should now have two children
      const finalContainer = result2.anchor as BlockNode
      expect(finalContainer.children).toHaveLength(2)
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
      const shallowResult = SetNodeByDeltaPathVisitor.setNodeAtPath(
        blockNodeTestStructure,
        [0],
        text("new"),
        "test_run_id"
      )

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(shallowResult, [0])
      ).toBeTextNode("new")
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(shallowResult, [1])
      ).toStrictEqual(
        GetNodeByDeltaPathVisitor.getNodeAtPath(blockNodeTestStructure, [1])
      )
      expect(shallowResult).not.toStrictEqual(blockNodeTestStructure)

      // Test deep path - this block structure has only 1 child in nested block
      const deepResult = SetNodeByDeltaPathVisitor.setNodeAtPath(
        blockNodeTestStructure,
        [1, 0],
        text("new_deep"),
        "test_run_id"
      )

      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(deepResult, [1, 0])
      ).toBeTextNode("new_deep")
      expect(
        GetNodeByDeltaPathVisitor.getNodeAtPath(deepResult, [0])
      ).toStrictEqual(
        GetNodeByDeltaPathVisitor.getNodeAtPath(blockNodeTestStructure, [0])
      )
      expect(deepResult).not.toStrictEqual(blockNodeTestStructure)

      // Test invalid path - trying to set at index 1 in nested block that has only 1 child (index 0)
      expect(() =>
        SetNodeByDeltaPathVisitor.setNodeAtPath(
          blockNodeTestStructure,
          [1, 2],
          text("invalid"),
          "test_run_id"
        )
      ).toThrow("Bad delta path index 2 (should be between [0, 1])")
    })
  })
})
