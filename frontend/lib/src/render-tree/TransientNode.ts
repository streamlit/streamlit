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
import { ElementNode } from "./ElementNode"
import { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"
import { DebugVisitor } from "./visitors/DebugVisitor"

/**
 * A TransientNode represents a transient Node in the tree that can hold
 * multiple transient Elements. It maintains an anchor node, which is the node
 * that would persist after the transient nodes are cleared.
 */

export class TransientNode implements AppNode {
  readonly anchor?: AppNode
  readonly transientNodes: ElementNode[]
  readonly scriptRunId: string
  readonly deltaMsgReceivedAt?: number
  readonly fragmentId?: string
  readonly activeScriptHash?: string

  constructor(
    scriptRunId: string,
    anchor?: AppNode,
    transientNodes?: ElementNode[],
    deltaMsgReceivedAt?: number
  ) {
    this.scriptRunId = scriptRunId
    this.anchor = anchor
    this.transientNodes = transientNodes ?? []
    this.deltaMsgReceivedAt = deltaMsgReceivedAt ?? Date.now()

    // We explicitly set these to undefined because transient nodes
    // are not associated with a fragment or a script hash directly.
    // The anchor node will have the fragmentId and activeScriptHash.
    this.fragmentId = undefined
    this.activeScriptHash = undefined
  }

  /**
   * Updates the transient nodes by applying a function to each transient node.
   * If the function returns undefined, the transient node is removed from the list.
   * @param update - A function that takes an ElementNode and returns an ElementNode or undefined.
   * @returns A new array of transient nodes.
   */
  public updateTransientNodes(
    update: (node: ElementNode) => ElementNode | undefined
  ): ElementNode[] {
    const newTransientNodes: ElementNode[] = []
    this.transientNodes.forEach(element => {
      const updatedElement = update(element)
      if (updatedElement) {
        newTransientNodes.push(updatedElement)
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
