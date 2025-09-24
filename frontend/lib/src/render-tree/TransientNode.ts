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

import { AppNode } from "./AppNode.interface"
import { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"
import { DebugVisitor } from "./visitors/DebugVisitor"

/**
 * A TransientNode represents a transient Node in the tree that can hold
 * multiple transient Nodes mapped by their IDs. It maintains an anchor
 * NodeNode and stores transient Nodes in a Map.
 */

export type TransientNodeMap = [string, AppNode, number][]
export type TransientNodeMapChange = [string, AppNode | undefined, number][]
export class TransientNode implements AppNode {
  readonly anchor?: AppNode
  readonly transientNodes: TransientNodeMap
  readonly scriptRunId: string
  readonly clearIdSet: Set<string>

  constructor(
    scriptRunId: string,
    anchor?: AppNode,
    transientNodes?: TransientNodeMapChange,
    clearIdSet?: Set<string>
  ) {
    this.scriptRunId = scriptRunId
    this.anchor = anchor
    this.clearIdSet = clearIdSet ?? new Set<string>()
    this.transientNodes = []
    transientNodes?.forEach(([id, element, orderIndex]) => {
      if (element === undefined) {
        this.clearIdSet.add(id)
      } else {
        this.transientNodes.push([id, element, orderIndex])
      }
    })
  }

  public hasTransientElement(id: string): boolean {
    return this.transientNodes.some(([nodeId]) => nodeId === id)
  }

  // Combine the information of the node with the updated information
  // of *this* node
  public replaceTransientNode(node: TransientNode): AppNode {
    const nodes = [...node.transientNodes, ...this.transientNodes]

    // The original node is the starting point, so we iterate over its transient nodes
    // and see if we should add it to the new one
    const elementSet = new Map<string, [AppNode, number]>()
    nodes.forEach(([id, elementToInclude, orderIndex]) => {
      elementSet.set(id, [elementToInclude, orderIndex])
      if (this.clearIdSet.has(id)) {
        elementSet.delete(id)
      }
    })

    const newTransientNodes: TransientNodeMap = []
    elementSet.forEach(([element, orderIndex], id) => {
      newTransientNodes.push([id, element, orderIndex])
    })

    // Combine the transient nodes of the two nodes
    return new TransientNode(
      this.scriptRunId,
      node.anchor ?? this.anchor,
      newTransientNodes.toSorted(
        ([, , orderIndex], [, , orderIndex2]) => orderIndex - orderIndex2
      ),
      this.clearIdSet.union(node.clearIdSet)
    )
  }

  public updateTransientNodes(
    update: (node: AppNode, id: string) => AppNode | undefined
  ): TransientNodeMap {
    const newTransientNodes: TransientNodeMap = []
    this.transientNodes.forEach(([id, element, orderIndex]) => {
      const updatedElement = update(element, id)
      if (updatedElement) {
        newTransientNodes.push([id, updatedElement, orderIndex])
      }
    })

    return newTransientNodes
  }

  accept<T>(visitor: AppNodeVisitor<T>): T {
    return visitor.visitTransientNode(this)
  }

  public debug(): string {
    return this.accept(new DebugVisitor())
  }
}
