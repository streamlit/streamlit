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

import { Block as BlockProto, Delta as DeltaProto } from "@streamlit/protobuf"

import { BlockNode } from "~lib/render-tree/BlockNode"
import {
  block,
  FAKE_SCRIPT_HASH,
  makeProto,
  text,
} from "~lib/render-tree/test-utils"
import { TransientNode } from "~lib/render-tree/TransientNode"

import { ClearTransientNodesVisitor } from "./ClearTransientNodesVisitor"

describe("ClearTransientNodesVisitor", () => {
  const TEXT_NODE = text("Hello")
  const TRANSIENT_NODE = new TransientNode(
    "script_run_id",
    TEXT_NODE,
    [text("Transient")],
    Date.now()
  )

  it("returns element nodes unchanged", () => {
    const visitor = new ClearTransientNodesVisitor([])
    expect(visitor.visitElementNode(TEXT_NODE)).toBe(TEXT_NODE)
  })

  it("returns the anchor of transient nodes", () => {
    const visitor = new ClearTransientNodesVisitor([])
    expect(visitor.visitTransientNode(TRANSIENT_NODE)).toBe(TEXT_NODE)
  })

  it("recurses into block nodes", () => {
    const blockNode = block([TRANSIENT_NODE])
    const visitor = new ClearTransientNodesVisitor([])
    const result = visitor.visitBlockNode(blockNode) as BlockNode

    expect(result).toBeInstanceOf(BlockNode)
    expect(result.children).toHaveLength(1)
    expect(result.children[0]).toBe(TEXT_NODE)
  })

  it("returns the same block node if no children changed", () => {
    const blockNode = block([TEXT_NODE])
    const visitor = new ClearTransientNodesVisitor([])
    const result = visitor.visitBlockNode(blockNode)

    expect(result).toBe(blockNode)
  })

  it("respects fragmentIdsThisRun", () => {
    // If fragmentIdsThisRun is set, and the block has a fragmentId NOT in the list,
    // it should not be traversed/cleared.

    // 1. Create a block with a fragmentId that IS in the list
    const fragmentBlock = new BlockNode(
      FAKE_SCRIPT_HASH,
      [TRANSIENT_NODE],
      makeProto(DeltaProto, {}).addBlock as BlockProto,
      "script_run_id",
      "my_fragment"
    )

    const visitor1 = new ClearTransientNodesVisitor(["my_fragment"])
    const result1 = visitor1.visitBlockNode(fragmentBlock) as BlockNode
    // Should be cleared (TransientNode -> TextNode)
    expect(result1.children[0]).toBe(TEXT_NODE)

    // 2. Create a block with a fragmentId that IS NOT in the list
    const otherFragmentBlock = new BlockNode(
      FAKE_SCRIPT_HASH,
      [TRANSIENT_NODE],
      makeProto(DeltaProto, {}).addBlock as BlockProto,
      "script_run_id",
      "other_fragment"
    )

    const visitor2 = new ClearTransientNodesVisitor(["my_fragment"])
    const result2 = visitor2.visitBlockNode(otherFragmentBlock)
    // Should NOT be cleared (should remain same block with TransientNode)
    expect(result2).toBe(otherFragmentBlock)
    expect((result2 as BlockNode).children[0]).toBe(TRANSIENT_NODE)
  })

  it("returns undefined when transient node has no anchor", () => {
    const transientWithNoAnchor = new TransientNode(
      "script_run_id",
      undefined,
      [text("Transient")],
      Date.now()
    )
    const visitor = new ClearTransientNodesVisitor([])
    expect(visitor.visitTransientNode(transientWithNoAnchor)).toBeUndefined()
  })

  it("traverses blocks without fragmentId even if fragmentIdsThisRun is set", () => {
    // If the block has NO fragmentId, it should be traversed regardless of fragmentIdsThisRun
    // (This is the default behavior for main root blocks usually, though depends on how the visitor is called)
    // The code says:
    // if (fragmentIdsThisRun.length > 0 && node.fragmentId && !fragmentIdsThisRun.includes(node.fragmentId)) return node

    // So if node.fragmentId is undefined, we proceed.

    const blockNode = block([TRANSIENT_NODE])
    const visitor = new ClearTransientNodesVisitor(["some_fragment"])
    const result = visitor.visitBlockNode(blockNode) as BlockNode

    expect(result).not.toBe(blockNode)
    expect(result.children[0]).toBe(TEXT_NODE)
  })
})
