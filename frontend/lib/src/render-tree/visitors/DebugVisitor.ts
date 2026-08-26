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

import {
  AppNode,
  BlockNode,
  ElementNode,
  NO_SCRIPT_RUN_ID,
  TransientNode,
} from "~lib/AppNode"

import { AppNodeVisitor } from "./AppNodeVisitor.interface"

export const MAX_HASH_LENGTH = 6

/**
 * Visitor that generates a tree-like debug representation of AppNodes.
 */
export class DebugVisitor implements AppNodeVisitor<string> {
  private readonly prefix: string
  private readonly isLast: boolean

  constructor(prefix = "", isLast = true) {
    this.prefix = prefix
    this.isLast = isLast
  }

  visitBlockNode(node: BlockNode): string {
    const connector = this.isLast ? "└── " : "├── "
    const childPrefix = this.prefix + (this.isLast ? "    " : "│   ")

    let result = `${this.prefix}${connector}BlockNode [${node.children.length} children]`
    if (node.scriptRunId !== NO_SCRIPT_RUN_ID) {
      result += ` (run: ${node.scriptRunId.substring(0, MAX_HASH_LENGTH)})`
    }
    result += "\n"

    node.children.forEach((child, index) => {
      const isLastChild = index === node.children.length - 1
      const visitor = new DebugVisitor(childPrefix, isLastChild)
      result += child.accept(visitor)
    })

    return result
  }

  visitElementNode(node: ElementNode): string {
    const connector = this.isLast ? "└── " : "├── "
    let result = `${this.prefix}${connector}ElementNode [${node.element.type}]`

    if (node.element.type === "text" && node.element.text?.body) {
      const text =
        node.element.text.body.length > 30
          ? `${node.element.text.body.slice(0, 30)}...`
          : node.element.text.body
      result += ` "${text}"`
    }

    if (node.scriptRunId !== NO_SCRIPT_RUN_ID) {
      result += ` (run: ${node.scriptRunId.substring(0, MAX_HASH_LENGTH)})`
    }

    if (node.fragmentId) {
      result += ` (fragment: ${node.fragmentId.substring(0, MAX_HASH_LENGTH)})`
    }
    result += ` (activeScriptHash: ${node.activeScriptHash.substring(0, MAX_HASH_LENGTH)})`

    result += "\n"
    return result
  }

  visitTransientNode(node: TransientNode): string {
    const connector = this.isLast ? "└── " : "├── "
    const childPrefix = this.prefix + (this.isLast ? "    " : "│   ")

    let result = `${this.prefix}${connector}TransientNode [${node.transientNodes.length} transient]`
    if (node.scriptRunId !== NO_SCRIPT_RUN_ID) {
      result += ` (run: ${node.scriptRunId.substring(0, MAX_HASH_LENGTH)})`
    }
    result += "\n"

    if (node.anchor) {
      result += `${childPrefix}├── anchor:\n`
      const anchorVisitor = new DebugVisitor(childPrefix + "│   ", true)
      result += node.anchor.accept(anchorVisitor)
    }

    if (node.transientNodes.length > 0) {
      result += `${childPrefix}└── transient nodes:\n`

      node.transientNodes.forEach((transientNode, index) => {
        const isLastTransient = index === node.transientNodes.length - 1
        const transientConnector = isLastTransient ? "└── " : "├── "
        const transientChildPrefix =
          childPrefix + "    " + (isLastTransient ? "    " : "│   ")

        result += `${childPrefix}    ${transientConnector}:\n`
        const transientVisitor = new DebugVisitor(transientChildPrefix, true)
        result += transientNode.accept(transientVisitor)
      })
    }

    return result
  }

  /**
   * Static helper method to generate debug output for any AppNode.
   */
  static generateDebugString(
    node: AppNode,
    prefix = "",
    isLast = true
  ): string {
    const visitor = new DebugVisitor(prefix, isLast)
    return node.accept(visitor)
  }
}
