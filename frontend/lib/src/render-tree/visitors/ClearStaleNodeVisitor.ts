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

import { ElementNode, notUndefined } from "~lib/index"
import { AppNode } from "~lib/render-tree/AppNode.interface"
import { BlockNode } from "~lib/render-tree/BlockNode"
import { StandaloneNode } from "~lib/render-tree/StandaloneNode"
import { TransientNode } from "~lib/render-tree/TransientNode"
import { AppNodeVisitor } from "~lib/render-tree/visitors/AppNodeVisitor.interface"

export class ClearStaleNodeVisitor
  implements AppNodeVisitor<AppNode | undefined>
{
  private readonly currentScriptRunId: string
  private readonly fragmentIdsThisRun: string[]
  private fragmentIdOfBlock?: string

  constructor(
    currentScriptRunId: string,
    fragmentIdsThisRun?: string[],
    fragmentIdOfBlock?: string
  ) {
    this.currentScriptRunId = currentScriptRunId
    this.fragmentIdsThisRun = fragmentIdsThisRun ?? []
    this.fragmentIdOfBlock = fragmentIdOfBlock
  }

  get isFragmentRun(): boolean {
    return this.fragmentIdsThisRun.length > 0
  }

  visitBlockNode(node: BlockNode): AppNode | undefined {
    let clearStaleNodeVisitor: ClearStaleNodeVisitor | null = null

    if (!this.fragmentIdsThisRun.length) {
      // If we're not currently running a fragment, then we can remove any blocks
      // that don't correspond to currentScriptRunId.
      if (node.scriptRunId !== this.currentScriptRunId) {
        return undefined
      }
    } else {
      // Otherwise, we are currently running a fragment, and our behavior
      // depends on the fragmentId of this BlockNode.

      // The parent block was modified but this element wasn't, so it's stale.
      if (
        this.fragmentIdOfBlock &&
        node.scriptRunId !== this.currentScriptRunId
      ) {
        return undefined
      }

      // This block is modified by the current run, so we indicate this to our children in case
      // they were not modified by the current run, which means they are stale.
      if (
        node.fragmentId &&
        this.fragmentIdsThisRun.includes(node.fragmentId) &&
        node.scriptRunId === this.currentScriptRunId
      ) {
        clearStaleNodeVisitor = new ClearStaleNodeVisitor(
          this.currentScriptRunId,
          this.fragmentIdsThisRun,
          node.fragmentId
        )
      }
    }

    // Recursively clear our children.
    const newChildren = node.children
      .map(child => {
        return child.accept<AppNode | undefined>(clearStaleNodeVisitor ?? this)
      })
      .filter(notUndefined)

    return new BlockNode(
      node.activeScriptHash,
      newChildren,
      node.deltaBlock,
      this.currentScriptRunId,
      node.fragmentId,
      node.deltaMsgReceivedAt
    )
  }

  visitElementNode(node: ElementNode): AppNode | undefined {
    if (this.isFragmentRun) {
      // If we're currently running a fragment, nodes unrelated to the fragment
      // shouldn't be cleared. This can happen when,
      //   1. This element doesn't correspond to a fragment at all.
      //   2. This element is a fragment but is in no path that was modified.
      //   3. This element belongs to a path that was modified, but it was modified in the same run.
      if (
        !node.fragmentId ||
        !this.fragmentIdOfBlock ||
        node.scriptRunId === this.currentScriptRunId
      ) {
        return node
      }
    }
    return node.scriptRunId === this.currentScriptRunId ? node : undefined
  }

  visitStandaloneNode<S>(node: StandaloneNode<S>): AppNode | undefined {
    // Check if we're running a fragment, ensure standalone node isn't cleared as stale (Issue #10350/#10382)
    if (this.isFragmentRun || node.scriptRunId === this.currentScriptRunId) {
      return node
    }

    return new StandaloneNode<S>(null, node.scriptRunId, node.activeScriptHash)
  }

  visitTransientNode(node: TransientNode): AppNode | undefined {
    // Check if we're running a fragment, ensure transient node isn't cleared as stale
    if (this.isFragmentRun) {
      return node
    }

    // Check whether the anchor element and transient elements are stale
    const anchorNode = node.anchor?.accept(this)
    const transientNodes = node.updateTransientNodes(element => {
      return element.accept(this)
    })

    // Everything is stale
    if (!anchorNode && transientNodes.length === 0) {
      return undefined
    }

    // All the transient elements are stale, but not the anchor element
    // so we return the anchor element
    if (transientNodes.length === 0) {
      return anchorNode
    }

    return new TransientNode(
      node.scriptRunId,
      anchorNode,
      transientNodes,
      node.clearIdSet
    )
  }
}
