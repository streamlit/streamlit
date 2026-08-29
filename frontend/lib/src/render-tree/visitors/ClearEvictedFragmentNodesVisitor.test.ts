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

import {
  Block as BlockProto,
  Element,
  ForwardMsgMetadata,
} from "@streamlit/protobuf"

import { BlockNode } from "~lib/render-tree/BlockNode"
import { ElementNode } from "~lib/render-tree/ElementNode"
import { FAKE_SCRIPT_HASH } from "~lib/render-tree/test-utils"
import { TransientNode } from "~lib/render-tree/TransientNode"

import { ClearEvictedFragmentNodesVisitor } from "./ClearEvictedFragmentNodesVisitor"

const SCRIPT_RUN_ID = "run_1"

function elementNode(body: string, fragmentId?: string): ElementNode {
  return new ElementNode(
    new Element({ text: { body } }),
    ForwardMsgMetadata.create(),
    SCRIPT_RUN_ID,
    FAKE_SCRIPT_HASH,
    fragmentId
  )
}

function toastNode(fragmentId?: string): ElementNode {
  return new ElementNode(
    new Element({ toast: { body: "Toast survives eviction" } }),
    ForwardMsgMetadata.create(),
    SCRIPT_RUN_ID,
    FAKE_SCRIPT_HASH,
    fragmentId
  )
}

function blockNode(
  children: (BlockNode | ElementNode)[],
  fragmentId?: string
): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    new BlockProto({ allowEmpty: true }),
    SCRIPT_RUN_ID,
    fragmentId
  )
}

/** True for the index-preserving stand-in the visitor substitutes. */
function isPlaceholder(node: unknown): boolean {
  return (
    node instanceof BlockNode &&
    node.children.length === 0 &&
    !node.deltaBlock.allowEmpty
  )
}

describe("ClearEvictedFragmentNodesVisitor", () => {
  it("replaces an evicted fragment's element with a placeholder", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))

    const result = elementNode("gone", "nested").accept(visitor)

    // An empty block with allowEmpty unset renders nothing, so the stale content
    // disappears while the index survives.
    expect(isPlaceholder(result)).toBe(true)
  })

  it("keeps element nodes of other fragments and of no fragment", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))

    const otherFragment = elementNode("kept", "outer")
    const noFragment = elementNode("kept")

    expect(otherFragment.accept(visitor)).toBe(otherFragment)
    expect(noFragment.accept(visitor)).toBe(noFragment)
  })

  it("preserves a toast emitted by an evicted fragment (issue #7740)", () => {
    // A fragment's toast carries that fragment's id. Replacing the node here
    // would drop the notification before the Toast component registers it with
    // the queue.
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
    const toast = toastNode("nested")

    expect(toast.accept(visitor)).toBe(toast)
  })

  it("keeps an evicted fragment's toast while replacing its other elements", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
    const toast = toastNode("nested")
    const parent = blockNode([toast, elementNode("gone", "nested")], "outer")

    const result = parent.accept(visitor) as BlockNode

    expect(result.children[0]).toBe(toast)
    expect(isPlaceholder(result.children[1])).toBe(true)
  })

  it("replaces a block of an evicted fragment, dropping its subtree", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
    const nestedBlock = blockNode([elementNode("inner")], "nested")

    expect(isPlaceholder(nestedBlock.accept(visitor))).toBe(true)
  })

  it("preserves sibling indices when replacing an evicted child", () => {
    // The point of substituting rather than removing: deltas address nodes by
    // absolute path, and `addBlock` inherits children instead of resetting them,
    // so compacting would leave every later sibling permanently shifted.
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
    const kept = elementNode("kept", "outer")
    const parent = blockNode(
      [blockNode([elementNode("inner", "nested")], "nested"), kept],
      "outer"
    )

    const result = parent.accept(visitor) as BlockNode

    expect(result.children).toHaveLength(2)
    expect(isPlaceholder(result.children[0])).toBe(true)
    // Still at index 1, not shifted down to 0.
    expect(result.children[1]).toBe(kept)
    expect(result.fragmentId).toBe("outer")
    expect(result.scriptRunId).toBe(SCRIPT_RUN_ID)
  })

  it("returns the identical node when nothing is evicted", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["absent"]))
    const parent = blockNode([elementNode("kept", "outer")], "outer")

    // Referential stability matters: a new node would re-render the subtree.
    expect(parent.accept(visitor)).toBe(parent)
  })

  it("replaces nodes nested several blocks deep", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
    const parent = blockNode([
      blockNode([blockNode([elementNode("deep", "nested")], "nested")]),
    ])

    const result = parent.accept(visitor) as BlockNode
    const middle = result.children[0] as BlockNode

    expect(middle.children).toHaveLength(1)
    expect(isPlaceholder(middle.children[0])).toBe(true)
  })

  describe("transient nodes", () => {
    it("returns the identical node when nothing in its subtree is evicted", () => {
      const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["absent"]))
      const transient = new TransientNode(
        SCRIPT_RUN_ID,
        elementNode("anchor", "outer"),
        [elementNode("transient", "outer")]
      )

      expect(transient.accept(visitor)).toBe(transient)
    })

    it("drops an evicted transient element but keeps the anchor", () => {
      const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
      const anchor = elementNode("anchor", "outer")
      const transient = new TransientNode(SCRIPT_RUN_ID, anchor, [
        elementNode("transient", "nested"),
      ])

      expect(transient.accept(visitor)).toBe(anchor)
    })

    it("replaces the node when it has no anchor and all transients are evicted", () => {
      // `addTransient` places a TransientNode at an absolute delta path with no
      // anchor, so removing it here would compact the parent and shift every
      // later sibling.
      const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
      const transient = new TransientNode(SCRIPT_RUN_ID, undefined, [
        elementNode("transient", "nested"),
      ])

      expect(isPlaceholder(transient.accept(visitor))).toBe(true)
    })

    it("replaces an evicted anchor rather than dropping it", () => {
      const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
      const transient = new TransientNode(
        SCRIPT_RUN_ID,
        elementNode("anchor", "nested"),
        [elementNode("transient", "outer")]
      )

      const result = transient.accept(visitor) as TransientNode

      expect(result).toBeInstanceOf(TransientNode)
      expect(isPlaceholder(result.anchor)).toBe(true)
    })

    it("keeps a transient toast belonging to an evicted fragment", () => {
      const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
      const toast = toastNode("nested")
      const transient = new TransientNode(
        SCRIPT_RUN_ID,
        elementNode("anchor", "outer"),
        [toast]
      )

      expect(transient.accept(visitor)).toBe(transient)
    })
  })
})
