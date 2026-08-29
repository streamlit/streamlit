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
 * Removes nodes whose `fragmentId` the server has evicted.
 *
 * Evicted ids arrive in `stopAutoRerun` (every evicted fragment, not only those
 * with a `run_every` timer). `ClearStaleNodeVisitor` cannot cover this: it only
 * prunes during a successful ancestor run, and `FINISHED_EARLY_FOR_RERUN` skips
 * that cleanup. Later runs are scoped to other fragments, so the evicted
 * subtree would stay on screen until a full rerun.
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
    // Drop the subtree: descendants belong to this fragment, or to nested
    // fragments the server also reports as evicted.
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
    // Toasts are fire-and-forget: the frontend toast queue owns their lifetime,
    // not the element tree. A toast emitted from a fragment carries that
    // fragment's id, so an eviction applied in the same batch as the toast delta
    // would remove the node before the Toast component registers it with the
    // queue, silently dropping the notification (issue #7740). The node renders
    // nothing on its own, so keeping it is safe. `ClearStaleNodeVisitor` makes
    // the same exception.
    if (node.element.type === "toast") {
      return node
    }

    return this.isEvicted(node.fragmentId) ? undefined : node
  }

  visitTransientNode(node: TransientNode): AppNode | undefined {
    const anchorNode = node.anchor?.accept(this)
    const transientNodes = node.updateTransientNodes(
      element => element.accept(this) as ElementNode | undefined
    )

    // Keep the same node when nothing in this subtree was evicted; a fresh node
    // would re-render it. `updateTransientNodes` either keeps an element
    // identically or drops it, so an unchanged length means nothing was
    // removed. This must precede the collapse cases below, which would
    // otherwise swap an untouched node for its anchor.
    if (
      anchorNode === node.anchor &&
      transientNodes.length === node.transientNodes.length
    ) {
      return node
    }

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
