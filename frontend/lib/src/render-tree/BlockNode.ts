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

import { notUndefined } from "~lib/util/utils"

import { AppNode, NO_SCRIPT_RUN_ID } from "./AppNode.interface"
import { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"
import { DebugVisitor } from "./visitors/DebugVisitor"

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

  public setIn(path: number[], node: AppNode, scriptRunId: string): BlockNode {
    if (path.length === 0) {
      throw new Error(`empty path!`)
    }

    const childIndex = path[0]
    if (childIndex < 0 || childIndex > this.children.length) {
      throw new Error(
        `Bad 'setIn' index ${childIndex} (should be between [0, ${this.children.length}])`
      )
    }

    const newChildren = this.children.slice()
    if (path.length === 1) {
      // Base case
      newChildren[childIndex] = node
    } else {
      // Pop the current element off our path, and recurse into our children
      newChildren[childIndex] = newChildren[childIndex].setIn(
        path.slice(1),
        node,
        scriptRunId
      )
    }

    return new BlockNode(
      this.activeScriptHash,
      newChildren,
      this.deltaBlock,
      scriptRunId,
      this.fragmentId,
      this.deltaMsgReceivedAt
    )
  }

  public clearStaleNodes(
    currentScriptRunId: string,
    fragmentIdsThisRun?: Array<string>,
    fragmentIdOfBlock?: string
  ): BlockNode | undefined {
    if (!fragmentIdsThisRun?.length) {
      // If we're not currently running a fragment, then we can remove any blocks
      // that don't correspond to currentScriptRunId.
      if (this.scriptRunId !== currentScriptRunId) {
        return undefined
      }
    } else {
      // Otherwise, we are currently running a fragment, and our behavior
      // depends on the fragmentId of this BlockNode.

      // The parent block was modified but this element wasn't, so it's stale.
      if (fragmentIdOfBlock && this.scriptRunId !== currentScriptRunId) {
        return undefined
      }

      // This block is modified by the current run, so we indicate this to our children in case
      // they were not modified by the current run, which means they are stale.
      if (
        this.fragmentId &&
        fragmentIdsThisRun.includes(this.fragmentId) &&
        this.scriptRunId === currentScriptRunId
      ) {
        fragmentIdOfBlock = this.fragmentId
      }
    }

    // Recursively clear our children.
    const newChildren = this.children
      .map(child => {
        return child.clearStaleNodes(
          currentScriptRunId,
          fragmentIdsThisRun,
          fragmentIdOfBlock
        )
      })
      .filter(notUndefined)

    return new BlockNode(
      this.activeScriptHash,
      newChildren,
      this.deltaBlock,
      currentScriptRunId,
      this.fragmentId,
      this.deltaMsgReceivedAt
    )
  }

  /**
   * Accept a visitor.
   * @param visitor - The visitor to accept.
   * @returns The result of the visitor's visitBlockNode method.
   * @example
   * const visitor = new DebugVisitor()
   * const result = blockNode.accept(visitor)
   * console.log(result)
   */
  public accept<T>(visitor: AppNodeVisitor<T>): T {
    return visitor.visitBlockNode(this)
  }

  /**
   * Returns a string representation of this BlockNode and its children,
   * primarily for debugging or logging purposes.
   *
   * @returns {string} A debug string describing the structure of this BlockNode.
   */
  public debug(): string {
    return this.accept(new DebugVisitor())
  }
}
