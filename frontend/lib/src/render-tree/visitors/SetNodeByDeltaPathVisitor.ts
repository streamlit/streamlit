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
 * A visitor that sets a node at a specific delta path, maintaining immutability
 * by creating new nodes along the path to the target location.
 *
 * Usage:
 * ```typescript
 * const visitor = new SetNodeByDeltaPathVisitor([1, 2, 0], newNode, "script_run_id")
 * const updatedTree = rootNode.accept(visitor)
 * ```
 */
export class SetNodeByDeltaPathVisitor implements AppNodeVisitor<AppNode> {
  private readonly deltaPath: number[]
  private readonly nodeToSet: AppNode
  private readonly scriptRunId: string

  constructor(deltaPath: number[], nodeToSet: AppNode, scriptRunId: string) {
    this.deltaPath = deltaPath
    this.nodeToSet = nodeToSet
    this.scriptRunId = scriptRunId
  }

  visitElementNode(node: ElementNode): AppNode {
    if (this.deltaPath.length > 0) {
      throw new Error("'setIn' cannot be called on an ElementNode")
    }

    // We are setting the element. If we are setting a transient node,
    // we have an opportunity to set the anchor.
    if (this.nodeToSet instanceof TransientNode && !this.nodeToSet.anchor) {
      return new TransientNode(
        this.nodeToSet.scriptRunId,
        node,
        this.nodeToSet.transientNodes,
        this.nodeToSet.deltaMsgReceivedAt
      )
    }

    return this.nodeToSet
  }

  visitTransientNode(node: TransientNode): AppNode {
    // If the path is empty, we're replacing this transient node.
    // Let the node decide how to best replace the transient node.
    // This is especially important for transient nodes to reconcile themselves.
    if (this.deltaPath.length === 0) {
      return this.nodeToSet.replaceTransientNodeWithSelf(node)
    }

    // TransientNode is transparent in the delta path hierarchy - it doesn't
    // consume an index from the path. We drill through to the anchor and
    // preserve the transient wrapper around the modified anchor.
    if (node.anchor) {
      const newAnchor = node.anchor.accept(this)
      return new TransientNode(
        node.scriptRunId,
        newAnchor,
        node.transientNodes,
        node.deltaMsgReceivedAt
      )
    }

    throw new Error("TransientNode has no anchor to set node at")
  }

  visitBlockNode(node: BlockNode): AppNode {
    if (this.deltaPath.length === 0) {
      // When replacing a BlockNode with a TransientNode that has no anchor,
      // capture the current BlockNode as the anchor. This preserves the original
      // block structure so it can be restored when transient elements are cleared.
      // This mirrors the analogous behavior in visitElementNode.
      if (this.nodeToSet instanceof TransientNode && !this.nodeToSet.anchor) {
        return new TransientNode(
          this.nodeToSet.scriptRunId,
          node,
          this.nodeToSet.transientNodes,
          this.nodeToSet.deltaMsgReceivedAt
        )
      }

      return this.nodeToSet
    }

    const [currentIndex, ...remainingPath] = this.deltaPath

    // Validate the index
    if (currentIndex < 0 || currentIndex > node.children.length) {
      throw new Error(
        `Bad delta path index ${currentIndex} (should be between [0, ${node.children.length}])`
      )
    }

    // Create a copy of the children array
    let newChildren: AppNode[] = []
    const childVisitor = new SetNodeByDeltaPathVisitor(
      remainingPath,
      this.nodeToSet,
      this.scriptRunId
    )

    // If the child at the current index is undefined, we assume we are out of bounds
    // This may be just an element being added at the end of the block.
    // So, we can just replace it with the nodeToSet assuming the path is valid.
    if (!node.children[currentIndex]) {
      if (remainingPath.length > 0) {
        throw new Error("Cannot set a node at a delta path")
      }

      newChildren = node.children.slice()
      newChildren[currentIndex] = this.nodeToSet
    } else {
      let index = 0
      while (index < node.children.length) {
        const child = node.children[index]

        if (index !== currentIndex) {
          newChildren.push(child)
          index++
          continue
        }

        const nextChild = child.accept(childVisitor)
        if (
          !(child instanceof TransientNode) &&
          nextChild instanceof TransientNode &&
          nextChild.anchor !== child
        ) {
          // This will be an insertion of the new transient
          // and not affect the existing non-transient child
          newChildren.push(nextChild)
          newChildren.push(child)
        } else {
          // This will be a replacement
          newChildren.push(nextChild)
        }
        index++
      }
    }

    // Create a new BlockNode with the updated children
    return new BlockNode(
      node.activeScriptHash,
      newChildren,
      node.deltaBlock,
      this.scriptRunId,
      node.fragmentId,
      node.deltaMsgReceivedAt
    )
  }

  /**
   * Static convenience method to set a node at a delta path.
   */
  static setNodeAtPath(
    rootNode: AppNode,
    deltaPath: number[],
    nodeToSet: AppNode,
    scriptRunId: string
  ): AppNode {
    const visitor = new SetNodeByDeltaPathVisitor(
      deltaPath,
      nodeToSet,
      scriptRunId
    )
    return rootNode.accept(visitor)
  }
}
