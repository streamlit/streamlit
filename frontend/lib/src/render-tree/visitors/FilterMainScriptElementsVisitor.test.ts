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
import { ElementNode } from "~lib/render-tree/ElementNode"
import { block, text } from "~lib/render-tree/test-utils"

import { FilterMainScriptElementsVisitor } from "./FilterMainScriptElementsVisitor"

const MAIN_SCRIPT_HASH = "main_script_hash"
const OTHER_SCRIPT_HASH = "other_script_hash"

describe("FilterMainScriptElementsVisitor", () => {
  describe("visitElementNode", () => {
    it("returns the element when activeScriptHash matches mainScriptHash", () => {
      const element = new ElementNode(
        text("test").element,
        text("test").metadata,
        "test_run_id",
        MAIN_SCRIPT_HASH
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)
      const result = visitor.visitElementNode(element)

      expect(result).toBe(element)
    })

    it("returns undefined when activeScriptHash does not match mainScriptHash", () => {
      const element = new ElementNode(
        text("test").element,
        text("test").metadata,
        "test_run_id",
        OTHER_SCRIPT_HASH
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)
      const result = visitor.visitElementNode(element)

      expect(result).toBeUndefined()
    })

    it("works with different script hashes", () => {
      const element1 = new ElementNode(
        text("test1").element,
        text("test1").metadata,
        "test_run_id",
        "script_hash_1"
      )

      const element2 = new ElementNode(
        text("test2").element,
        text("test2").metadata,
        "test_run_id",
        "script_hash_2"
      )

      const visitor1 = new FilterMainScriptElementsVisitor("script_hash_1")
      const visitor2 = new FilterMainScriptElementsVisitor("script_hash_2")

      expect(visitor1.visitElementNode(element1)).toBe(element1)
      expect(visitor1.visitElementNode(element2)).toBeUndefined()
      expect(visitor2.visitElementNode(element1)).toBeUndefined()
      expect(visitor2.visitElementNode(element2)).toBe(element2)
    })
  })

  describe("visitBlockNode", () => {
    it("returns the block when activeScriptHash matches mainScriptHash and has no children", () => {
      const blockNode = new BlockNode(
        MAIN_SCRIPT_HASH,
        [],
        block().deltaBlock,
        "test_run_id"
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)
      const result = visitor.visitBlockNode(blockNode)

      expect(result).toBeInstanceOf(BlockNode)
      expect((result as BlockNode).activeScriptHash).toBe(MAIN_SCRIPT_HASH)
      expect((result as BlockNode).children).toHaveLength(0)
    })

    it("returns undefined when activeScriptHash does not match mainScriptHash", () => {
      const blockNode = new BlockNode(
        OTHER_SCRIPT_HASH,
        [],
        block().deltaBlock,
        "test_run_id"
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)
      const result = visitor.visitBlockNode(blockNode)

      expect(result).toBeUndefined()
    })

    it("filters children recursively when activeScriptHash matches", () => {
      // Create children with mixed script hashes
      const matchingElement = new ElementNode(
        text("matching").element,
        text("matching").metadata,
        "test_run_id",
        MAIN_SCRIPT_HASH
      )

      const nonMatchingElement = new ElementNode(
        text("non-matching").element,
        text("non-matching").metadata,
        "test_run_id",
        OTHER_SCRIPT_HASH
      )

      const matchingBlock = new BlockNode(
        MAIN_SCRIPT_HASH,
        [matchingElement],
        block().deltaBlock,
        "test_run_id"
      )

      const nonMatchingBlock = new BlockNode(
        OTHER_SCRIPT_HASH,
        [nonMatchingElement],
        block().deltaBlock,
        "test_run_id"
      )

      const parentBlock = new BlockNode(
        MAIN_SCRIPT_HASH,
        [matchingElement, nonMatchingElement, matchingBlock, nonMatchingBlock],
        block().deltaBlock,
        "test_run_id"
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)
      const result = visitor.visitBlockNode(parentBlock) as BlockNode

      expect(result).toBeInstanceOf(BlockNode)
      expect(result.children).toHaveLength(2) // Only matching element and matching block
      expect(result.children[0]).toBe(matchingElement)
      expect(result.children[1]).toBeInstanceOf(BlockNode)
      expect((result.children[1] as BlockNode).activeScriptHash).toBe(
        MAIN_SCRIPT_HASH
      )
    })

    it("preserves block properties when creating filtered version", () => {
      const originalBlock = new BlockNode(
        MAIN_SCRIPT_HASH,
        [],
        block().deltaBlock,
        "original_run_id",
        "fragment_id",
        1234567890
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)
      const result = visitor.visitBlockNode(originalBlock) as BlockNode

      expect(result.activeScriptHash).toBe(MAIN_SCRIPT_HASH)
      expect(result.scriptRunId).toBe("original_run_id")
      expect(result.fragmentId).toBe("fragment_id")
      expect(result.deltaMsgReceivedAt).toBe(1234567890)
      expect(result.deltaBlock).toBe(originalBlock.deltaBlock)
    })

    it("returns empty block when all children are filtered out", () => {
      const nonMatchingElement1 = new ElementNode(
        text("non-matching1").element,
        text("non-matching1").metadata,
        "test_run_id",
        OTHER_SCRIPT_HASH
      )

      const nonMatchingElement2 = new ElementNode(
        text("non-matching2").element,
        text("non-matching2").metadata,
        "test_run_id",
        "another_script_hash"
      )

      const parentBlock = new BlockNode(
        MAIN_SCRIPT_HASH,
        [nonMatchingElement1, nonMatchingElement2],
        block().deltaBlock,
        "test_run_id"
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)
      const result = visitor.visitBlockNode(parentBlock) as BlockNode

      expect(result).toBeInstanceOf(BlockNode)
      expect(result.children).toHaveLength(0)
      expect(result.isEmpty).toBe(true)
    })
  })

  describe("static filterNode", () => {
    it("filters an ElementNode using static method", () => {
      const matchingElement = new ElementNode(
        text("matching").element,
        text("matching").metadata,
        "test_run_id",
        MAIN_SCRIPT_HASH
      )

      const nonMatchingElement = new ElementNode(
        text("non-matching").element,
        text("non-matching").metadata,
        "test_run_id",
        OTHER_SCRIPT_HASH
      )

      const result1 = FilterMainScriptElementsVisitor.filterNode(
        matchingElement,
        MAIN_SCRIPT_HASH
      )
      const result2 = FilterMainScriptElementsVisitor.filterNode(
        nonMatchingElement,
        MAIN_SCRIPT_HASH
      )

      expect(result1).toBe(matchingElement)
      expect(result2).toBeUndefined()
    })

    it("filters a BlockNode using static method", () => {
      const matchingElement = new ElementNode(
        text("matching").element,
        text("matching").metadata,
        "test_run_id",
        MAIN_SCRIPT_HASH
      )

      const nonMatchingElement = new ElementNode(
        text("non-matching").element,
        text("non-matching").metadata,
        "test_run_id",
        OTHER_SCRIPT_HASH
      )

      const blockNode = new BlockNode(
        MAIN_SCRIPT_HASH,
        [matchingElement, nonMatchingElement],
        block().deltaBlock,
        "test_run_id"
      )

      const result = FilterMainScriptElementsVisitor.filterNode(
        blockNode,
        MAIN_SCRIPT_HASH
      ) as BlockNode

      expect(result).toBeInstanceOf(BlockNode)
      expect(result.children).toHaveLength(1)
      expect(result.children[0]).toBe(matchingElement)
    })
  })

  describe("complex tree filtering", () => {
    it("handles deeply nested structures", () => {
      // Create a deeply nested structure with mixed script hashes
      const deepElement1 = new ElementNode(
        text("deep1").element,
        text("deep1").metadata,
        "test_run_id",
        MAIN_SCRIPT_HASH
      )

      const deepElement2 = new ElementNode(
        text("deep2").element,
        text("deep2").metadata,
        "test_run_id",
        OTHER_SCRIPT_HASH
      )

      const level2Block = new BlockNode(
        MAIN_SCRIPT_HASH,
        [deepElement1, deepElement2],
        block().deltaBlock,
        "test_run_id"
      )

      const level1Block = new BlockNode(
        MAIN_SCRIPT_HASH,
        [level2Block],
        block().deltaBlock,
        "test_run_id"
      )

      const rootBlock = new BlockNode(
        MAIN_SCRIPT_HASH,
        [level1Block],
        block().deltaBlock,
        "test_run_id"
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)
      const result = visitor.visitBlockNode(rootBlock) as BlockNode

      expect(result).toBeInstanceOf(BlockNode)
      expect(result.children).toHaveLength(1)

      const filteredLevel1 = result.children[0] as BlockNode
      expect(filteredLevel1.children).toHaveLength(1)

      const filteredLevel2 = filteredLevel1.children[0] as BlockNode
      expect(filteredLevel2.children).toHaveLength(1) // Only deepElement1 should remain
      expect(filteredLevel2.children[0]).toBe(deepElement1)
    })

    it("handles mixed node types at same level", () => {
      const matchingElement = new ElementNode(
        text("matching_element").element,
        text("matching_element").metadata,
        "test_run_id",
        MAIN_SCRIPT_HASH
      )
      const matchingElement2 = new ElementNode(
        text("matching_element").element,
        text("matching_element").metadata,
        "test_run_id",
        MAIN_SCRIPT_HASH
      )

      const nonMatchingElement = new ElementNode(
        text("non_matching_element").element,
        text("non_matching_element").metadata,
        "test_run_id",
        OTHER_SCRIPT_HASH
      )

      const nonMatchingElement2 = new ElementNode(
        text("non_matching_element").element,
        text("non_matching_element").metadata,
        "test_run_id",
        OTHER_SCRIPT_HASH
      )

      const matchingChildBlock = new BlockNode(
        MAIN_SCRIPT_HASH,
        [matchingElement],
        block().deltaBlock,
        "test_run_id"
      )

      const nonMatchingChildBlock = new BlockNode(
        OTHER_SCRIPT_HASH,
        [nonMatchingElement],
        block().deltaBlock,
        "test_run_id"
      )

      const parentBlock = new BlockNode(
        MAIN_SCRIPT_HASH,
        [
          matchingElement2,
          nonMatchingElement2,
          matchingChildBlock,
          nonMatchingChildBlock,
        ],
        block().deltaBlock,
        "test_run_id"
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)
      const result = visitor.visitBlockNode(parentBlock) as BlockNode

      expect(result.children).toHaveLength(2) // matching element and matching block
      expect(result.children[0]).toBe(matchingElement2)
      expect(result.children[1]).toBeInstanceOf(BlockNode)
      expect((result.children[1] as BlockNode).activeScriptHash).toBe(
        MAIN_SCRIPT_HASH
      )
    })
  })

  describe("edge cases", () => {
    it("handles empty mainScriptHash", () => {
      const element = new ElementNode(
        text("test").element,
        text("test").metadata,
        "test_run_id",
        ""
      )

      const visitor = new FilterMainScriptElementsVisitor("")
      const result = visitor.visitElementNode(element)

      expect(result).toBe(element)
    })

    it("handles empty activeScriptHash", () => {
      const element = new ElementNode(
        text("test").element,
        text("test").metadata,
        "test_run_id",
        ""
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)
      const result = visitor.visitElementNode(element)

      expect(result).toBeUndefined()
    })

    it("handles case-sensitive script hash matching", () => {
      const element = new ElementNode(
        text("test").element,
        text("test").metadata,
        "test_run_id",
        "Script_Hash"
      )

      const visitor1 = new FilterMainScriptElementsVisitor("Script_Hash")
      const visitor2 = new FilterMainScriptElementsVisitor("script_hash")

      expect(visitor1.visitElementNode(element)).toBe(element)
      expect(visitor2.visitElementNode(element)).toBeUndefined()
    })

    it("preserves visitor state across multiple visits", () => {
      const element1 = new ElementNode(
        text("test1").element,
        text("test1").metadata,
        "test_run_id",
        MAIN_SCRIPT_HASH
      )

      const element2 = new ElementNode(
        text("test2").element,
        text("test2").metadata,
        "test_run_id",
        OTHER_SCRIPT_HASH
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)

      const result1 = visitor.visitElementNode(element1)
      const result2 = visitor.visitElementNode(element2)
      const result3 = visitor.visitElementNode(element1) // Visit first element again

      expect(result1).toBe(element1)
      expect(result2).toBeUndefined()
      expect(result3).toBe(element1) // Should still work
    })

    it("returns original node when no children change", () => {
      // All children match, so none are filtered
      const matchingElement1 = new ElementNode(
        text("element1").element,
        text("element1").metadata,
        "test_run_id",
        MAIN_SCRIPT_HASH
      )

      const matchingElement2 = new ElementNode(
        text("element2").element,
        text("element2").metadata,
        "test_run_id",
        MAIN_SCRIPT_HASH
      )

      const blockNode = new BlockNode(
        MAIN_SCRIPT_HASH,
        [matchingElement1, matchingElement2],
        block().deltaBlock,
        "test_run_id"
      )

      const visitor = new FilterMainScriptElementsVisitor(MAIN_SCRIPT_HASH)
      const result = visitor.visitBlockNode(blockNode)

      // Should return THE SAME reference (not a new object)
      // This is the childrenChanged optimization
      expect(result).toBe(blockNode)
    })
  })
})
