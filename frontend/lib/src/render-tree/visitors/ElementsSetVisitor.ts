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

import { Element } from "@streamlit/protobuf"

import { AppNode } from "~lib/render-tree/AppNode.interface"
import { BlockNode } from "~lib/render-tree/BlockNode"
import { ElementNode } from "~lib/render-tree/ElementNode"
import type { AppNodeVisitor } from "~lib/render-tree/visitors/AppNodeVisitor.interface"

/**
 * A visitor that collects all Elements from an AppNode tree.
 *
 * This visitor uses a mutable Set for performance, accumulating elements
 * as it traverses the tree. The visitor methods return the Set directly
 * for convenience, but the return value only needs to be used at the end
 * of the traversal.
 *
 * Usage:
 * ```typescript
 * const visitor = new ElementsSetVisitor()
 * rootNode.accept(visitor)
 * const elements = visitor.elements
 * ```
 */
export class ElementsSetVisitor implements AppNodeVisitor<Set<Element>> {
  public readonly elements: Set<Element>

  constructor() {
    this.elements = new Set<Element>()
  }

  visitElementNode(node: ElementNode): Set<Element> {
    this.elements.add(node.element)
    return this.elements
  }

  visitBlockNode(node: BlockNode): Set<Element> {
    // Visit each child and accumulate elements in our mutable set
    for (const child of node.children) {
      child.accept(this)
    }
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
