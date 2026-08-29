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

import { Block as BlockProto } from "@streamlit/protobuf"

import { AppNode, BlockNode, ElementNode, TransientNode } from "~lib/AppNode"

import { AppNodeVisitor } from "./AppNodeVisitor.interface"

/**
 * Replaces nodes of server-evicted fragments with empty blocks that render
 * nothing.
 *
 * - Evicted ids arrive in `stopAutoRerun` — every evicted fragment, not only
 *   those with a `run_every` timer.
 * - `ClearStaleNodeVisitor` cannot cover this: it prunes only during a
 *   successful ancestor run, and `FINISHED_EARLY_FOR_RERUN` skips that cleanup.
 *   Later runs are scoped to other fragments, so the subtree would linger.
 * - Replace, never remove: deltas address nodes by absolute path. Removing
 *   compacts the parent's `children`, and `addBlock` inherits children rather
 *   than resetting them, so every later sibling keeps a shifted index and a
 *   fragment that reruns writes to the wrong slot.
 * - Placeholders don't accumulate: they carry no `fragmentId`, so a repeat
 *   eviction matches nothing and the tree is returned unchanged. A returning
 *   fragment overwrites the slot, and a later full run prunes them via their
 *   stale `scriptRunId`.
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

  /**
   * Whether this element should be replaced.
   *
   * Toasts are fire-and-forget: the frontend toast queue owns their lifetime,
   * not the element tree. Replacing a toast node before the `Toast` component
   * registers it silently drops the notification (issue #7740); keeping it is
   * safe because the node renders nothing itself.
   * `ClearStaleNodeVisitor.visitElementNode` makes the same exception. Note
   * `st.toast` always writes to the event container, so a toast is never inside
   * a fragment-owned block that `visitBlockNode` replaces wholesale.
   */
  private shouldReplace(node: ElementNode): boolean {
    return node.element.type !== "toast" && this.isEvicted(node.fragmentId)
  }

  /**
   * An index-preserving stand-in that renders nothing.
   *
   * Deliberately omits `fragmentId`, so a repeat eviction leaves the tree
   * untouched, and leaves `deltaBlock.type` unset, so `AppRoot.addBlock` does
   * not treat a returning block as the same type and inherit these (empty)
   * children.
   */
  private makePlaceholder(
    activeScriptHash: string,
    scriptRunId: string
  ): BlockNode {
    return new BlockNode(activeScriptHash, [], new BlockProto({}), scriptRunId)
  }

  visitBlockNode(node: BlockNode): AppNode | undefined {
    // Replace the whole subtree: its descendants belong to this fragment, or to
    // nested fragments the server also reports as evicted.
    if (this.isEvicted(node.fragmentId)) {
      return this.makePlaceholder(node.activeScriptHash, node.scriptRunId)
    }

    const newChildren: AppNode[] = []
    let childrenChanged = false

    node.children.forEach(child => {
      const newChild = child.accept(this)
      if (newChild !== child) {
        childrenChanged = true
      }
      if (newChild !== undefined) {
        newChildren.push(newChild)
      }
    })

    // Performance optimization: if nothing changed, keep the same node so React
    // does not re-render this subtree.
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
    return this.shouldReplace(node)
      ? this.makePlaceholder(node.activeScriptHash, node.scriptRunId)
      : node
  }

  visitTransientNode(node: TransientNode): AppNode | undefined {
    const anchorNode = node.anchor?.accept(this)
    // Transient *elements* are dropped rather than replaced: they are addressed
    // as a set within this node, not by their own absolute path. The node
    // itself does occupy an absolute path, so it is replaced below rather than
    // removed.
    const transientNodes = node.updateTransientNodes(element =>
      this.shouldReplace(element) ? undefined : element
    )

    // Keep the same node when nothing in this subtree was evicted; a fresh node
    // would re-render it. `updateTransientNodes` either keeps an element
    // identically or drops it, so an unchanged length means nothing was
    // removed. This must precede the cases below, which would otherwise swap an
    // untouched node for its anchor.
    if (
      anchorNode === node.anchor &&
      transientNodes.length === node.transientNodes.length
    ) {
      return node
    }

    // Everything here was evicted. `addTransient` places this node at an
    // absolute delta path (often with no anchor yet), so returning `undefined`
    // would compact the parent and shift every later sibling.
    if (!anchorNode && transientNodes.length === 0) {
      // Reaching here means the identity check above did not fire, so at least
      // one transient element existed and was dropped; take its script hash.
      const [firstTransient] = node.transientNodes
      return this.makePlaceholder(
        firstTransient.activeScriptHash,
        node.scriptRunId
      )
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
