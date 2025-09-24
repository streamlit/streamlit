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
import { StandaloneNode } from "~lib/render-tree/StandaloneNode"
import { TransientNode } from "~lib/render-tree/TransientNode"

import { AppNodeVisitor } from "./AppNodeVisitor.interface"

/**
 * A visitor that retrieves a node at a specific delta path.
 *
 * This replaces the getIn method functionality from AppNode implementations.
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
    // ElementNodes are leaf nodes - they have no children to traverse
    return undefined
  }

  visitStandaloneNode<S>(_node: StandaloneNode<S>): AppNode | undefined {
    // StandaloneNodes are leaf nodes - they have no children to traverse
    return undefined
  }

  visitTransientNode(node: TransientNode): AppNode | undefined {
    if (this.deltaPath.length === 0) {
      return undefined
    }

    const [currentIndex, ...remainingPath] = this.deltaPath

    if (currentIndex < 0 || currentIndex >= node.transientNodes.length) {
      return undefined
    }

    if (remainingPath.length === 0) {
      return node.anchor
    }

    return node.accept(new GetNodeByDeltaPathVisitor(remainingPath))
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
      // Base case: we're at the target location, return the child
      return node.children[currentIndex]
    }

    // Recursive case: continue down the path
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
