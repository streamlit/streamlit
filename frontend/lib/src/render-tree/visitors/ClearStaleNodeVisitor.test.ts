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

import { Element, ForwardMsgMetadata } from "@streamlit/protobuf"

import { TransientNode } from "~lib/render-tree/TransientNode"

import { BlockNode } from "src/render-tree/BlockNode"
import { ElementNode } from "src/render-tree/ElementNode"
import { block, makeProto, text } from "src/render-tree/test-utils"

import { ClearStaleNodeVisitor } from "./ClearStaleNodeVisitor"

describe("ClearStaleNodeVisitor", () => {
  describe("visitElementNode", () => {
    it("returns the element if it matches the current script run ID", () => {
      const currentRunId = "current_run"
      const element = text("test", currentRunId)
      const visitor = new ClearStaleNodeVisitor(currentRunId)

      const result = visitor.visitElementNode(element)

      expect(result).toBe(element)
    })

    it("returns undefined for elements with different script run ID", () => {
      const currentRunId = "current_run"
      const staleElement = text("stale", "old_run")
      const visitor = new ClearStaleNodeVisitor(currentRunId)

      const result = visitor.visitElementNode(staleElement)

      expect(result).toBeUndefined()
    })

    describe("when running fragments", () => {
      it("returns element if it doesn't have a fragment ID", () => {
        const currentRunId = "current_run"
        const element = text("no_fragment", "old_run")
        const visitor = new ClearStaleNodeVisitor(currentRunId, ["fragment1"])

        const result = visitor.visitElementNode(element)

        expect(result).toBe(element)
      })

      it("returns element if fragmentIdOfBlock is not set", () => {
        const currentRunId = "current_run"
        const element = new ElementNode(
          makeProto(Element, { text: { body: "with_fragment" } }),
          ForwardMsgMetadata.create(),
          "old_run",
          "script_hash",
          "fragment1"
        )
        const visitor = new ClearStaleNodeVisitor(currentRunId, ["fragment1"])

        const result = visitor.visitElementNode(element)

        expect(result).toBe(element)
      })

      it("returns element if it matches current script run ID", () => {
        const currentRunId = "current_run"
        const element = new ElementNode(
          makeProto(Element, { text: { body: "current" } }),
          ForwardMsgMetadata.create(),
          currentRunId,
          "script_hash",
          "fragment1"
        )
        const visitor = new ClearStaleNodeVisitor(
          currentRunId,
          ["fragment1"],
          "fragment1"
        )

        const result = visitor.visitElementNode(element)

        expect(result).toBe(element)
      })

      it("returns undefined for stale element in fragment context", () => {
        const currentRunId = "current_run"
        const staleElement = new ElementNode(
          makeProto(Element, { text: { body: "stale" } }),
          ForwardMsgMetadata.create(),
          "old_run",
          "script_hash",
          "fragment1"
        )
        const visitor = new ClearStaleNodeVisitor(
          currentRunId,
          ["fragment1"],
          "fragment1"
        )

        const result = visitor.visitElementNode(staleElement)

        expect(result).toBeUndefined()
      })
    })
  })

  describe("visitBlockNode", () => {
    it("returns undefined for block with different script run ID", () => {
      const currentRunId = "current_run"
      const staleBlock = block([text("child")], "old_run")
      const visitor = new ClearStaleNodeVisitor(currentRunId)

      const result = visitor.visitBlockNode(staleBlock)

      expect(result).toBeUndefined()
    })

    it("returns new block with filtered children for current run ID", () => {
      const currentRunId = "current_run"
      const currentElement = text("current", currentRunId)
      const staleElement = text("stale", "old_run")
      const blockNode = new BlockNode(
        "script_hash",
        [currentElement, staleElement],
        undefined,
        currentRunId
      )
      const visitor = new ClearStaleNodeVisitor(currentRunId)

      const result = visitor.visitBlockNode(blockNode) as BlockNode

      expect(result).toBeDefined()
      expect(result.children).toHaveLength(1)
      expect(result.children[0]).toBe(currentElement)
    })

    it("returns same node reference when children are unchanged (performance optimization)", () => {
      const currentRunId = "current_run"
      const currentElement1 = text("current1", currentRunId)
      const currentElement2 = text("current2", currentRunId)
      const blockNode = new BlockNode(
        "script_hash",
        [currentElement1, currentElement2],
        undefined,
        currentRunId
      )
      const visitor = new ClearStaleNodeVisitor(currentRunId)

      const result = visitor.visitBlockNode(blockNode) as BlockNode

      // Performance optimization: when no children are filtered, return the same node reference
      expect(result).toBe(blockNode)
    })

    it("preserves block structure with nested children", () => {
      const currentRunId = "current_run"
      const innerBlock = block([text("inner", currentRunId)], currentRunId)
      const outerBlock = new BlockNode(
        "script_hash",
        [innerBlock, text("outer", "old_run")],
        undefined,
        currentRunId
      )
      const visitor = new ClearStaleNodeVisitor(currentRunId)

      const result = visitor.visitBlockNode(outerBlock) as BlockNode

      expect(result).toBeDefined()
      expect(result.children).toHaveLength(1)
      expect(result.children[0]).toBeInstanceOf(BlockNode)
      expect((result.children[0] as BlockNode).children).toHaveLength(1)
    })

    it("returns same node reference for nested blocks when all children are unchanged", () => {
      const currentRunId = "current_run"
      const innerBlock = block([text("inner", currentRunId)], currentRunId)
      const outerBlock = new BlockNode(
        "script_hash",
        [innerBlock, text("outer", currentRunId)],
        undefined,
        currentRunId
      )
      const visitor = new ClearStaleNodeVisitor(currentRunId)

      const result = visitor.visitBlockNode(outerBlock) as BlockNode

      // Performance optimization: when all nested children are unchanged, return the same node reference
      expect(result).toBe(outerBlock)
      expect(result.children).toHaveLength(2)
      // Inner block should also be the same reference due to optimization
      expect(result.children[0]).toBe(innerBlock)
    })

    describe("fragment handling", () => {
      it("handles fragment block correctly", () => {
        const currentRunId = "current_run"
        const fragmentId = "fragment1"
        const fragmentBlock = new BlockNode(
          "script_hash",
          [text("fragment_child", currentRunId)],
          undefined,
          currentRunId,
          fragmentId
        )
        const visitor = new ClearStaleNodeVisitor(currentRunId, [fragmentId])

        const result = visitor.visitBlockNode(fragmentBlock) as BlockNode

        expect(result).toBeDefined()
        expect(result.fragmentId).toBe(fragmentId)
        expect(result.children).toHaveLength(1)
      })

      it("removes stale block in fragment context", () => {
        const currentRunId = "current_run"
        const fragmentId = "fragment1"
        const staleBlock = new BlockNode(
          "script_hash",
          [text("stale_child", "old_run")],
          undefined,
          "old_run",
          fragmentId
        )
        const visitor = new ClearStaleNodeVisitor(
          currentRunId,
          [fragmentId],
          fragmentId
        )

        const result = visitor.visitBlockNode(staleBlock)

        expect(result).toBeUndefined()
      })

      it("creates new visitor for fragment children", () => {
        const currentRunId = "current_run"
        const fragmentId = "fragment1"
        const childElement = text("child", "old_run")
        const fragmentBlock = new BlockNode(
          "script_hash",
          [childElement],
          undefined,
          currentRunId,
          fragmentId
        )
        const visitor = new ClearStaleNodeVisitor(currentRunId, [fragmentId])

        const result = visitor.visitBlockNode(fragmentBlock) as BlockNode

        expect(result).toBeDefined()
        // Child element should be preserved because it doesn't have a fragment ID
        // and we're not in a fragment context yet (fragmentIdOfBlock is not set)
        expect(result.children).toHaveLength(1)
      })
    })
  })

  describe("visitTransientNode", () => {
    it("restores anchor for transient cleared in current run when anchor is current", () => {
      const currentRunId = "current"
      const anchor = text("anchor", currentRunId)
      const clearedTransient = new TransientNode(currentRunId, anchor, [], 1)

      const visitor = new ClearStaleNodeVisitor(currentRunId)
      const result = visitor.visitTransientNode(clearedTransient)

      expect(result).toBe(anchor)
    })

    it("returns undefined for transient cleared in current run when anchor is stale", () => {
      const currentRunId = "current"
      const staleAnchor = text("anchor", "old_run")
      const clearedTransient = new TransientNode(
        currentRunId,
        staleAnchor,
        [],
        1
      )

      const visitor = new ClearStaleNodeVisitor(currentRunId)
      const result = visitor.visitTransientNode(clearedTransient)

      expect(result).toBeUndefined()
    })

    it("preserves stale anchor without fragmentId during fragment run when transient is cleared", () => {
      // Scenario: A transient cleared in the current run has an anchor from a
      // previous run that has no fragmentId. During a fragment run, elements
      // without fragmentId should be preserved (not cleared as stale).
      const currentRunId = "current"
      const staleAnchorNoFragment = text("anchor", "old_run") // no fragmentId
      const clearedTransient = new TransientNode(
        currentRunId,
        staleAnchorNoFragment,
        [],
        1
      )

      const visitor = new ClearStaleNodeVisitor(currentRunId, ["fragment1"])
      const result = visitor.visitTransientNode(clearedTransient)

      // The anchor should be preserved because it doesn't have a fragmentId
      // and we're in a fragment run (visitElementNode preserves such elements)
      expect(result).toBe(staleAnchorNoFragment)
    })

    it("returns undefined when both anchor and transients are stale", () => {
      const t = new TransientNode(
        "runA",
        text("a", "old"),
        [text("t1", "old")],
        1
      )
      const visitor = new ClearStaleNodeVisitor("current")
      const result = visitor.visitTransientNode(t)
      expect(result).toBeUndefined()
    })

    it("returns anchor when only anchor is current and all transients are stale", () => {
      const anchor = text("a", "current")
      const t = new TransientNode(
        "runA",
        anchor,
        [text("t1", "old"), text("t2", "old")],
        1
      )
      const visitor = new ClearStaleNodeVisitor("current")
      const result = visitor.visitTransientNode(t)
      expect(result).toBe(anchor)
    })

    it("returns new TransientNode when some transients remain current", () => {
      const anchor = text("a", "old")
      const keep = text("keep", "cur")
      const drop = text("drop", "old")
      const t = new TransientNode("runA", anchor, [keep, drop], 7)
      const visitor = new ClearStaleNodeVisitor("cur")
      const result = visitor.visitTransientNode(t) as TransientNode
      expect(result).toBeInstanceOf(TransientNode)
      expect(result.anchor).toBeUndefined() // anchor was stale
      expect(result.transientNodes).toEqual([keep])
      expect(result.deltaMsgReceivedAt).toBe(7)
    })
  })

  describe("integration scenarios", () => {
    it("clears complex nested structure correctly", () => {
      const currentRunId = "current_run"
      const staleRunId = "stale_run"

      // Create a complex tree structure
      const currentText = text("current", currentRunId)
      const staleText = text("stale", staleRunId)
      const mixedBlock = new BlockNode(
        "script_hash",
        [currentText, staleText],
        undefined,
        currentRunId
      )
      const staleBlock = block([text("all_stale", staleRunId)], staleRunId)
      const rootBlock = new BlockNode(
        "script_hash",
        [mixedBlock, staleBlock],
        undefined,
        currentRunId
      )

      const visitor = new ClearStaleNodeVisitor(currentRunId)
      const result = visitor.visitBlockNode(rootBlock) as BlockNode

      expect(result).toBeDefined()
      expect(result.children).toHaveLength(1) // staleBlock should be removed
      expect((result.children[0] as BlockNode).children).toHaveLength(1) // only currentText should remain
      expect((result.children[0] as BlockNode).children[0]).toBe(currentText)
    })

    it("handles empty results gracefully", () => {
      const currentRunId = "current_run"
      const allStaleBlock = new BlockNode(
        "script_hash",
        [text("stale1", "old_run"), text("stale2", "another_old_run")],
        undefined,
        "old_run"
      )

      const visitor = new ClearStaleNodeVisitor(currentRunId)
      const result = visitor.visitBlockNode(allStaleBlock)

      expect(result).toBeUndefined()
    })

    it("preserves all elements when all are current", () => {
      const currentRunId = "current_run"
      const element1 = text("current1", currentRunId)
      const element2 = text("current2", currentRunId)
      const block1 = new BlockNode(
        "script_hash",
        [element1],
        undefined,
        currentRunId
      )
      const block2 = new BlockNode(
        "script_hash",
        [element2],
        undefined,
        currentRunId
      )
      const rootBlock = new BlockNode(
        "script_hash",
        [block1, block2],
        undefined,
        currentRunId
      )

      const visitor = new ClearStaleNodeVisitor(currentRunId)
      const result = visitor.visitBlockNode(rootBlock) as BlockNode

      expect(result).toBeDefined()
      expect(result.children).toHaveLength(2)
      expect((result.children[0] as BlockNode).children[0]).toBe(element1)
      expect((result.children[1] as BlockNode).children[0]).toBe(element2)
    })
  })
})
