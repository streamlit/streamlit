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

import { Block as BlockProto, Element } from "@streamlit/protobuf"

import { isNullOrUndefined, notUndefined } from "~lib/util/utils"

import { AppNode, NO_SCRIPT_RUN_ID } from "./AppNode.interface"

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

  public getIn(path: number[]): AppNode | undefined {
    if (path.length === 0) {
      return undefined
    }

    const childIndex = path[0]
    if (childIndex < 0 || childIndex >= this.children.length) {
      return undefined
    }

    if (path.length === 1) {
      return this.children[childIndex]
    }

    return this.children[childIndex].getIn(path.slice(1))
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

  filterMainScriptElements(mainScriptHash: string): AppNode | undefined {
    if (this.activeScriptHash !== mainScriptHash) {
      return undefined
    }

    // Recursively clear our children.
    const newChildren = this.children
      .map(child => child.filterMainScriptElements(mainScriptHash))
      .filter(notUndefined)

    return new BlockNode(
      this.activeScriptHash,
      newChildren,
      this.deltaBlock,
      this.scriptRunId,
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

  public getElements(elementSet?: Set<Element>): Set<Element> {
    if (isNullOrUndefined(elementSet)) {
      elementSet = new Set<Element>()
    }

    for (const child of this.children) {
      child.getElements(elementSet)
    }

    return elementSet
  }
}
