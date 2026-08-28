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

import { AppNodeVisitor } from "./AppNodeVisitor.interface"

/**
 * Visitor that removes nodes belonging to fragments the server has evicted.
 *
 * Enforces the invariant that a fragment the server has dropped owns no nodes
 * in the element tree. The server reports evicted fragments explicitly (see
 * `clear_stale_descendants`, which reports every evicted fragment and not only
 * those with a `run_every` timer), so this does not depend on inferring
 * staleness from script run ids.
 *
 * `ClearStaleNodeVisitor` cannot be relied on for this: it prunes a nested
 * fragment only during a run that both writes the ancestor's subtree and
 * completes successfully. A fragment rerun that ends as
 * `FINISHED_EARLY_FOR_RERUN` skips that cleanup entirely, and the runs that
 * follow are scoped to other fragments, so nothing revisits the evicted
 * fragment's subtree. Its auto-rerun is cancelled at the same time, leaving the
 * nodes frozen on screen showing stale content until a full rerun.
 *
 * Usage:
 * ```typescript
 * const visitor = new ClearEvictedFragmentNodesVisitor(evictedFragmentIds)
 * const newNode = node.accept(visitor)
 * // newNode will be undefined if the node should be filtered out
 * ```
 */
export class ClearEvictedFragmentNodesVisitor implements AppNodeVisitor<
  AppNode | undefined
> {
  private readonly evictedFragmentIds: ReadonlySet<string>

  constructor(evictedFragmentIds: ReadonlySet<string>) {
    this.evictedFragmentIds = evictedFragmentIds
  }

  private isEvicted(fragmentId: string | undefined): boolean {
    return !!fragmentId && this.evictedFragmentIds.has(fragmentId)
  }

  visitBlockNode(node: BlockNode): AppNode | undefined {
    if (this.isEvicted(node.fragmentId)) {
      return undefined
    }

    const newChildren: AppNode[] = []
    let childrenChanged = false

    node.children.forEach(child => {
      const filteredChild = child.accept(this)
      if (filteredChild !== child) {
        childrenChanged = true
      }
      if (filteredChild !== undefined) {
        newChildren.push(filteredChild)
      }
    })

    // Performance optimization: if nothing was removed, keep the same node so
    // React does not re-render this subtree.
    if (!childrenChanged) {
      return node
    }

    return new BlockNode(
      node.activeScriptHash,
      newChildren,
      node.deltaBlock,
      node.scriptRunId,
      node.fragmentId,
      node.deltaMsgReceivedAt
    )
  }

  visitElementNode(node: ElementNode): AppNode | undefined {
    return this.isEvicted(node.fragmentId) ? undefined : node
  }

  visitTransientNode(node: TransientNode): AppNode | undefined {
    const anchorNode = node.anchor?.accept(this)
    const transientNodes = node.updateTransientNodes(
      element => element.accept(this) as ElementNode | undefined
    )

    if (!anchorNode && transientNodes.length === 0) {
      return undefined
    }

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
