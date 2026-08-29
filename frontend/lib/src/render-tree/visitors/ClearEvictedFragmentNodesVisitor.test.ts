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

describe("ClearEvictedFragmentNodesVisitor", () => {
  it("removes an element node belonging to an evicted fragment", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))

    expect(elementNode("gone", "nested").accept(visitor)).toBeUndefined()
  })

  it("keeps element nodes of other fragments and of no fragment", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))

    const otherFragment = elementNode("kept", "outer")
    const noFragment = elementNode("kept")

    expect(otherFragment.accept(visitor)).toBe(otherFragment)
    expect(noFragment.accept(visitor)).toBe(noFragment)
  })

  it("removes a block belonging to an evicted fragment, with its subtree", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
    const nestedBlock = blockNode([elementNode("inner")], "nested")

    expect(nestedBlock.accept(visitor)).toBeUndefined()
  })

  it("removes an evicted child from a surviving parent block", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
    const kept = elementNode("kept", "outer")
    const parent = blockNode(
      [kept, blockNode([elementNode("inner", "nested")], "nested")],
      "outer"
    )

    const result = parent.accept(visitor) as BlockNode

    expect(result).not.toBe(parent)
    expect(result.children).toHaveLength(1)
    expect(result.children[0]).toBe(kept)
    // Identity of the surviving parent's own metadata is preserved.
    expect(result.fragmentId).toBe("outer")
    expect(result.scriptRunId).toBe(SCRIPT_RUN_ID)
  })

  it("returns the identical node when nothing is evicted", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["absent"]))
    const parent = blockNode([elementNode("kept", "outer")], "outer")

    // Referential stability matters: a new node would re-render the subtree.
    expect(parent.accept(visitor)).toBe(parent)
  })

  describe("transient nodes", () => {
    it("returns the identical node when nothing in its subtree is evicted", () => {
      const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["absent"]))
      const transient = new TransientNode(
        SCRIPT_RUN_ID,
        elementNode("anchor", "outer"),
        [elementNode("toast", "outer")]
      )

      // Referential stability: reconstructing would re-render this subtree.
      expect(transient.accept(visitor)).toBe(transient)
    })

    it("drops an evicted transient element but keeps the anchor", () => {
      const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
      const anchor = elementNode("anchor", "outer")
      const transient = new TransientNode(SCRIPT_RUN_ID, anchor, [
        elementNode("toast", "nested"),
      ])

      expect(transient.accept(visitor)).toBe(anchor)
    })

    it("removes the whole node when anchor and transients are evicted", () => {
      const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
      const transient = new TransientNode(
        SCRIPT_RUN_ID,
        elementNode("anchor", "nested"),
        [elementNode("toast", "nested")]
      )

      expect(transient.accept(visitor)).toBeUndefined()
    })
  })

  it("removes nodes nested several blocks deep", () => {
    const visitor = new ClearEvictedFragmentNodesVisitor(new Set(["nested"]))
    const parent = blockNode([
      blockNode([blockNode([elementNode("deep", "nested")], "nested")]),
    ])

    const result = parent.accept(visitor) as BlockNode

    expect(result.children).toHaveLength(1)
    expect((result.children[0] as BlockNode).children).toHaveLength(0)
  })
})
