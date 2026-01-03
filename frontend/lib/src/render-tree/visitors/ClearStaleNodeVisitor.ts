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

import { AppNode, BlockNode, ElementNode, TransientNode } from "~lib/AppNode"
import { AppNodeVisitor } from "~lib/render-tree/visitors/AppNodeVisitor.interface"

/**
 * Visitor that clears stale nodes from the render tree. It does this by:
 *
 * 1. If we're not currently running a fragment, then we can remove any nodes
 *    that don't correspond to currentScriptRunId.
 * 2. If we are currently running a fragment, and the parent block was modified but this element wasn't,
 *    then it's stale.
 * 3. If we are currently running a fragment, and this block is modified by the current run,
 *    then we indicate this to our children in case they were not modified by the current run,
 *    which means they are stale.
 * 4. We recursively clear our children.
 *
 * Usage:
 * ```typescript
 * const visitor = new ClearStaleNodeVisitor(currentScriptRunId, fragmentIdsThisRun, fragmentIdOfBlock)
 * const newNode = node.accept(visitor)
 * // newNode will be undefined if the node should be filtered out
 * ```
 */
export class ClearStaleNodeVisitor implements AppNodeVisitor<
  AppNode | undefined
> {
  private readonly currentScriptRunId: string
  private readonly fragmentIdsThisRun: string[]
  private readonly fragmentIdOfBlock?: string

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

    if (!this.isFragmentRun) {
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
    const newChildren: AppNode[] = []
    let childrenChanged = false
    node.children.forEach(child => {
      const filteredChild = child.accept(clearStaleNodeVisitor ?? this)
      if (filteredChild !== child) {
        childrenChanged = true
      }
      if (filteredChild !== undefined) {
        newChildren.push(filteredChild)
      }
    })

    // Performance optimization: If the children haven't changed, return the same node.
    if (!childrenChanged) {
      return node
    }

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

  visitTransientNode(node: TransientNode): AppNode | undefined {
    // Check whether the anchor element and transient elements are stale
    const anchorNode = node.anchor?.accept(this)
    const transientNodes = node.updateTransientNodes(element => {
      return element.accept(this) as ElementNode | undefined
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
      node.deltaMsgReceivedAt
    )
  }
}
