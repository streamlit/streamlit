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

import { AppNodeVisitor } from "./AppNodeVisitor.interface"

/**
 * A visitor that retrieves a node at a specific delta path.
 *
 * Usage:
 * ```typescript
 * const visitor = new GetNodeByDeltaPathVisitor([1, 2, 0])
 * const foundNode = rootNode.accept(visitor)
 * ```
 */
export class GetNodeByDeltaPathVisitor
  implements AppNodeVisitor<AppNode | undefined>
{
  private readonly deltaPath: number[]

  constructor(deltaPath: number[]) {
    this.deltaPath = deltaPath
  }

  visitElementNode(_node: ElementNode): AppNode | undefined {
    // ElementNodes have no children, so there is nothing to check
    return undefined
  }

  visitBlockNode(node: BlockNode): AppNode | undefined {
    if (this.deltaPath.length === 0) {
      return undefined
    }

    const [currentIndex, ...remainingPath] = this.deltaPath

    // Check if the index is valid
    if (currentIndex < 0 || currentIndex >= node.children.length) {
      return undefined
    }

    if (remainingPath.length === 0) {
      // Base case: we've consumed the entire path (at target location), return the target node
      return node.children[currentIndex]
    }

    // Recursive case: create a new visitor and continue traversal
    const childVisitor = new GetNodeByDeltaPathVisitor(remainingPath)
    return node.children[currentIndex].accept(childVisitor)
  }

  /**
   * Static convenience method to get a node at a delta path.
   */
  static getNodeAtPath(
    rootNode: AppNode,
    deltaPath: number[]
  ): AppNode | undefined {
    const visitor = new GetNodeByDeltaPathVisitor(deltaPath)
    return rootNode.accept(visitor)
  }
}
