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

import { Block as BlockProto } from "@streamlit/protobuf"

import { AppNode } from "./AppNode.interface"
import { ElementNode } from "./ElementNode"
import { TransientNode } from "./TransientNode"
import { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"
import { ClearStaleNodeVisitor } from "./visitors/ClearStaleNodeVisitor"
import { DebugVisitor } from "./visitors/DebugVisitor"

const NO_SCRIPT_RUN_ID = "NO_SCRIPT_RUN_ID"

/**
 * A container AppNode that holds children.
 */
export class BlockNode implements AppNode {
  public readonly children: AppNode[]

  public readonly deltaBlock: BlockProto

  public readonly scriptRunId: string

  public readonly fragmentId?: string

  public readonly deltaMsgReceivedAt?: number

  // The hash of the script that created this block.
  public readonly activeScriptHash: string

  public constructor(
    activeScriptHash: string,
    children?: AppNode[],
    deltaBlock?: BlockProto,
    scriptRunId?: string,
    fragmentId?: string,
    deltaMsgReceivedAt?: number
  ) {
    this.activeScriptHash = activeScriptHash
    this.children = children ?? []
    this.deltaBlock = deltaBlock ?? new BlockProto({})
    this.scriptRunId = scriptRunId ?? NO_SCRIPT_RUN_ID
    this.fragmentId = fragmentId
    this.deltaMsgReceivedAt = deltaMsgReceivedAt
  }

  /** True if this Block has no children. */
  public get isEmpty(): boolean {
    return this.children.length === 0
  }

  public accept<T>(visitor: AppNodeVisitor<T>): T {
    return visitor.visitBlockNode(this)
  }

  public replaceTransientNode(node: TransientNode): AppNode {
    if (node.scriptRunId !== this.scriptRunId) {
      // This TransientNode was not defined in this script run, so we return the element node
      // to replace everything
      return this
    }

    // It's essentially an empty transient node, so we return the element node
    if (!node.anchor && node.transientNodes.length === 0) {
      return this
    }

    // At this point, we should clear the transient nodes that are stale
    const newTransientNodes = node.updateTransientNodes(
      element =>
        element.accept(new ClearStaleNodeVisitor(this.scriptRunId)) as
          | ElementNode
          | undefined
    )

    // In this case, we require the transient node to be included, but we are providing
    // a new anchor node
    return new TransientNode(this.scriptRunId, this, newTransientNodes)
  }

  public debug(): string {
    return this.accept(new DebugVisitor())
  }
}
