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

/**
 * A TransientNode represents a transient Node in the tree that can hold
 * multiple transient Nodes mapped by their IDs. It maintains an anchor
 * NodeNode and stores transient Nodes in a Map.
 */
export class TransientNode implements AppNode {
  readonly anchor?: AppNode
  readonly transientNodes: Map<string, AppNode>
  readonly scriptRunId: string

  constructor(
    scriptRunId: string,
    anchor?: AppNode,
    transientNodes?: Map<string, AppNode>
  ) {
    this.scriptRunId = scriptRunId
    this.anchor = anchor
    this.transientNodes = transientNodes ?? new Map<string, AppNode>()
  }

  public replaceTransientNode(node: TransientNode): AppNode {
    // Combine the transient nodes of the two nodes
    return new TransientNode(
      this.scriptRunId,
      node.anchor ?? this.anchor,
      // TODO(kmcgrady): Verify that multiple transient elements will disappear
      this.transientNodes
    )
  }

  public updateTransientNodes(
    update: (node: AppNode, id: string) => AppNode | undefined
  ): Map<string, AppNode> {
    const newTransientNodes = new Map<string, AppNode>()
    this.transientNodes.forEach((element, id) => {
      const updatedElement = update(element, id)
      if (updatedElement) {
        newTransientNodes.set(id, updatedElement)
      }
    })

    return newTransientNodes
  }

  accept<T>(visitor: AppNodeVisitor<T>): T {
    return visitor.visitTransientNode(this)
  }
}
