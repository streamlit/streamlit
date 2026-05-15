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

import { Element, ForwardMsgMetadata } from "@streamlit/protobuf"

import { AppNode } from "./AppNode.interface"
import { TransientNode } from "./TransientNode"
import { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"
import { ClearStaleNodeVisitor } from "./visitors/ClearStaleNodeVisitor"
import { DebugVisitor } from "./visitors/DebugVisitor"

/**
 * A leaf AppNode. Contains a single element to render.
 */
export class ElementNode implements AppNode {
  public readonly element: Element

  public readonly metadata: ForwardMsgMetadata

  public readonly scriptRunId: string

  public readonly fragmentId?: string

  // The hash of the script that created this element.
  public readonly activeScriptHash: string

  // The hash of this element's payload for content-based deduplication.
  public readonly elementHash?: string

  /** Create a new ElementNode. */
  public constructor(
    element: Element,
    metadata: ForwardMsgMetadata,
    scriptRunId: string,
    activeScriptHash: string,
    fragmentId?: string,
    elementHash?: string
  ) {
    this.element = element
    this.metadata = metadata
    this.scriptRunId = scriptRunId
    this.activeScriptHash = activeScriptHash
    this.fragmentId = fragmentId
    this.elementHash = elementHash
  }

  /**
   * Accept a visitor.
   * @param visitor - The visitor to accept.
   * @returns The result of the visitor's visitElementNode method.
   * @example
   * const visitor = new DebugVisitor()
   * const result = elementNode.accept(visitor)
   * console.log(result)
   */
  public accept<T>(visitor: AppNodeVisitor<T>): T {
    return visitor.visitElementNode(this)
  }

  /**
   * Returns a string representation of this ElementNode for debugging purposes.
   * This method can be used to log or inspect the state of the node.
   *
   * @returns {string} A debug string describing this node.
   */
  public debug(): string {
    return this.accept(new DebugVisitor())
  }

  public replaceTransientNodeWithSelf(node: TransientNode): AppNode {
    if (node.scriptRunId !== this.scriptRunId) {
      // This TransientNode was not defined in this script run, so we return the element node
      // to replace everything
      return this
    }

    // It's essentially an empty transient node, so we return the element node
    if (node.transientNodes.length === 0) {
      return this
    }

    // At this point, we should clear the transient nodes that are stale
    const newTransientNodes = node.updateTransientNodes(
      element =>
        // All transient nodes should be ElementNodes
        element.accept(new ClearStaleNodeVisitor(this.scriptRunId)) as
          | ElementNode
          | undefined
    )

    // The resulting transient node is empty, so we return this node
    if (newTransientNodes.length === 0) {
      return this
    }

    // In this case, we require the transient node to be included, but we are providing
    // a new anchor node
    return new TransientNode(
      this.scriptRunId,
      this,
      newTransientNodes,
      node.deltaMsgReceivedAt
    )
  }
}
