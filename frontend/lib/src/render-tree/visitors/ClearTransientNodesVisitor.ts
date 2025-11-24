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
 * Visitor that clears transient nodes from the render tree. It does this by:
 *
 * 1. If there are fragment IDs this run, and this block is not one of them,
 *    then it should not be traversed/cleared.
 * 2. It recurses into block nodes.
 * 3. It returns the same block node if no children changed.
 */
export class ClearTransientNodesVisitor implements AppNodeVisitor<
  AppNode | undefined
> {
  private readonly fragmentIdsThisRun: string[]

  constructor(fragmentIdsThisRun: string[] | undefined) {
    this.fragmentIdsThisRun = fragmentIdsThisRun ?? []
  }

  visitBlockNode(node: BlockNode): AppNode | undefined {
    if (
      // There are fragment IDs this run, and this block is not one of them
      this.fragmentIdsThisRun.length > 0 &&
      node.fragmentId &&
      !this.fragmentIdsThisRun.includes(node.fragmentId)
    ) {
      return node
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

    // Performance optimization: If the children haven't changed, return the same node.
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
    // There are no transient nodes to clear.
    return node
  }

  visitTransientNode(node: TransientNode): AppNode | undefined {
    // Clear the transient nodes and just show the anchor node
    return node.anchor
  }
}
