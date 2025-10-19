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

import { AppNode } from "~lib/render-tree/AppNode.interface"
import { BlockNode } from "~lib/render-tree/BlockNode"
import { ElementNode } from "~lib/render-tree/ElementNode"
import { TransientNode } from "~lib/render-tree/TransientNode"

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
    if (deltaPath.length === 0) {
      throw new Error("deltaPath cannot be empty")
    }
    this.deltaPath = deltaPath
    this.nodeToSet = nodeToSet
    this.scriptRunId = scriptRunId
  }

  visitElementNode(_node: ElementNode): AppNode {
    // ElementNodes are leaf nodes - they cannot have children set
    throw new Error("'SetNodeByDeltaPathVisitor' cannot visit an ElementNode")
  }

  visitBlockNode(node: BlockNode): AppNode {
    const [currentIndex, ...remainingPath] = this.deltaPath

    // Validate the index
    if (currentIndex < 0 || currentIndex > node.children.length) {
      throw new Error(
        `Bad delta path index ${currentIndex} (should be between [0, ${node.children.length}])`
      )
    }

    // Create a copy of the children array
    const newChildren = node.children.slice()

    if (remainingPath.length === 0) {
      // Base case: we're at the target location, set the node
      newChildren[currentIndex] = this.nodeToSet
    } else {
      // Recursive case: continue down the path
      const childVisitor = new SetNodeByDeltaPathVisitor(
        remainingPath,
        this.nodeToSet,
        this.scriptRunId
      )
      newChildren[currentIndex] =
        newChildren[currentIndex].accept(childVisitor)
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

  visitTransientNode(_node: TransientNode): AppNode {
    throw new Error("Method not implemented.")
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
