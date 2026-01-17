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

import { AppNode } from "~lib/render-tree/AppNode.interface"
import { BlockNode } from "~lib/render-tree/BlockNode"
import { ElementNode } from "~lib/render-tree/ElementNode"
import { TransientNode } from "~lib/render-tree/TransientNode"

import { AppNodeVisitor } from "./AppNodeVisitor.interface"

/**
 * A visitor that filters out nodes whose activeScriptHash does not match
 * the specified mainScriptHash. This is used to remove stale elements
 * that were created by scripts that are no longer the main script.
 *
 * Usage:
 * ```typescript
 * const visitor = new FilterMainScriptElementsVisitor(mainScriptHash)
 * const filteredNode = node.accept(visitor)
 * // filteredNode will be undefined if the node should be filtered out
 * ```
 */
export class FilterMainScriptElementsVisitor implements AppNodeVisitor<
  AppNode | undefined
> {
  private readonly mainScriptHash: string

  constructor(mainScriptHash: string) {
    this.mainScriptHash = mainScriptHash
  }

  visitElementNode(node: ElementNode): AppNode | undefined {
    if (node.activeScriptHash !== this.mainScriptHash) {
      return undefined
    }
    return node
  }

  visitBlockNode(node: BlockNode): AppNode | undefined {
    if (node.activeScriptHash !== this.mainScriptHash) {
      return undefined
    }

    let childrenChanged = false
    const newChildren = []
    for (const child of node.children) {
      const filteredChild = child.accept(this)
      if (filteredChild !== child) {
        childrenChanged = true
      }
      if (filteredChild !== undefined) {
        newChildren.push(filteredChild)
      }
    }

    // Shortcut to avoid re-creating the same block node
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

  visitTransientNode(node: TransientNode): AppNode | undefined {
    // visit both the anchor and the transient nodes to possibly filter them out
    const anchorNode = node.anchor?.accept(this)
    const transientNodes = node.updateTransientNodes(element => {
      return element.accept(this) as ElementNode | undefined
    })

    // Everything is filtered out
    if (!anchorNode && transientNodes.length === 0) {
      return undefined
    }

    // All the transient nodes are filtered out, but not the anchor node
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

  /**
   * Static convenience method to filter a node tree based on mainScriptHash.
   */
  static filterNode(
    node: AppNode,
    mainScriptHash: string
  ): AppNode | undefined {
    const visitor = new FilterMainScriptElementsVisitor(mainScriptHash)
    return node.accept(visitor)
  }
}
