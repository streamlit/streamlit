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

import { Element } from "@streamlit/protobuf"

import { AppNode } from "~lib/render-tree/AppNode.interface"
import { BlockNode } from "~lib/render-tree/BlockNode"
import { ElementNode } from "~lib/render-tree/ElementNode"
import { TransientNode } from "~lib/render-tree/TransientNode"
import type { AppNodeVisitor } from "~lib/render-tree/visitors/AppNodeVisitor.interface"

/**
 * A visitor that collects all Elements, stable block IDs, and fragment IDs
 * from an AppNode tree.
 *
 * - `elements`: all Element protos found in ElementNodes.
 * - `blockIds`: IDs from BlockNodes that have a stable identity (e.g. keyed
 *   layout containers). These are used to prevent `elementStates` entries
 *   from being garbage-collected.
 * - `fragmentIds`: fragment IDs from live BlockNodes and ElementNodes. These
 *   are used to determine which fragment-scoped resources should remain active.
 *
 * This visitor uses mutable Sets for performance, accumulating results
 * as it traverses the tree. The visitor methods return the element Set
 * directly for convenience, but the return value only needs to be used
 * at the end of the traversal.
 *
 * Usage:
 * ```typescript
 * const visitor = new ElementsSetVisitor()
 * rootNode.accept(visitor)
 * const elements = visitor.elements
 * const blockIds = visitor.blockIds
 * const fragmentIds = visitor.fragmentIds
 * ```
 */
export class ElementsSetVisitor implements AppNodeVisitor<Set<Element>> {
  public readonly elements: Set<Element>
  public readonly blockIds: Set<string>
  public readonly fragmentIds: Set<string>

  constructor() {
    this.elements = new Set<Element>()
    this.blockIds = new Set<string>()
    this.fragmentIds = new Set<string>()
  }

  visitElementNode(node: ElementNode): Set<Element> {
    this.elements.add(node.element)
    if (node.fragmentId) {
      this.fragmentIds.add(node.fragmentId)
    }
    return this.elements
  }

  visitBlockNode(node: BlockNode): Set<Element> {
    if (node.deltaBlock?.id) {
      this.blockIds.add(node.deltaBlock.id)
    }
    if (node.fragmentId) {
      this.fragmentIds.add(node.fragmentId)
    }
    for (const child of node.children) {
      child.accept(this)
    }
    return this.elements
  }

  /**
   * Traverse both transient payload elements and the transient anchor so
   * fragment IDs attached to either side remain visible to callers.
   */
  visitTransientNode(node: TransientNode): Set<Element> {
    // Add all transient elements to the set
    node.transientNodes.forEach(element => {
      element.accept(this)
    })

    // Also visit the anchor ElementNode to collect its element
    node.anchor?.accept(this)

    return this.elements
  }

  /**
   * Static convenience method to collect all elements from a node tree.
   */
  static collectElements(node: AppNode): Set<Element> {
    const visitor = new ElementsSetVisitor()
    node.accept(visitor)
    return visitor.elements
  }
}
