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

import type { Spinner as SpinnerProto } from "@streamlit/protobuf"

import type { AppNode } from "./AppNode.interface"
import { BlockNode } from "./BlockNode"
import { ElementNode } from "./ElementNode"
import { TransientNode } from "./TransientNode"

/**
 * Element types that aren't content a user waits for: slot placeholders
 * (skeleton, empty) and elements outside the layout (toast, balloons, snow).
 */
const NON_CONTENT_ELEMENT_TYPES = new Set([
  "skeleton",
  "empty",
  "toast",
  "balloons",
  "snow",
])

/**
 * Whether `node` contains visible content, from any run or only from the run
 * `scriptRunId`. Transient elements, such as spinners, never count; only a
 * transient node's anchor does.
 */
function hasVisibleContent(
  node: AppNode | undefined,
  scriptRunId?: string
): boolean {
  if (node instanceof ElementNode) {
    return (
      !NON_CONTENT_ELEMENT_TYPES.has(node.element.type ?? "") &&
      (scriptRunId === undefined || node.scriptRunId === scriptRunId)
    )
  }
  if (node instanceof BlockNode) {
    return node.children.some(child => hasVisibleContent(child, scriptRunId))
  }
  if (node instanceof TransientNode) {
    return hasVisibleContent(node.anchor, scriptRunId)
  }
  return false
}

/** Find a spinner from the run `scriptRunId` that labels the slot's skeleton. */
function findSkeletonLabel(
  node: AppNode | undefined,
  scriptRunId: string
): SpinnerProto.$Properties | undefined {
  if (node instanceof BlockNode) {
    for (const child of node.children) {
      const label = findSkeletonLabel(child, scriptRunId)
      if (label !== undefined) return label
    }
  }
  if (node instanceof TransientNode) {
    const spinner = node.transientNodes.find(
      transient =>
        transient.scriptRunId === scriptRunId &&
        transient.element.spinner?.inSkeletonSlot === true
    )?.element.spinner
    return spinner ?? findSkeletonLabel(node.anchor, scriptRunId)
  }
  return undefined
}

/** How a loading block (`Block.loading`) renders its skeleton right now. */
export interface LoadingBlockState {
  /** Whether the block waits for its first visible element of this run. */
  isPending: boolean
  /**
   * Whether the block still holds a previous run's content, which stays
   * mounted and is covered after a grace period.
   */
  hasPreviousContent: boolean
  /** The spinner to show on the skeleton as its label. */
  label?: SpinnerProto.$Properties
}

const NOT_PENDING: LoadingBlockState = {
  isPending: false,
  hasPreviousContent: false,
}

/**
 * Compute the skeleton state of `node` for the run `scriptRunId`. A loading
 * block is pending until that run draws visible content into it or ends, so a
 * skeleton whose content never arrives doesn't outlive the run.
 *
 * In a fragment run, only the running fragments' loading blocks are pending:
 * - A write gives every block on its path the run's ID, so without this check
 *   a fragment rerun would also cover the loading block it renders in.
 * - A nested fragment that its parent's rerun calls inline writes with its own
 *   fragment ID, so its blocks keep their previous content.
 */
export function getLoadingBlockState(
  node: BlockNode,
  scriptRunId: string,
  isRunning: boolean,
  fragmentIdsThisRun: readonly string[]
): LoadingBlockState {
  if (
    !node.deltaBlock.loading ||
    !isRunning ||
    node.scriptRunId !== scriptRunId ||
    (fragmentIdsThisRun.length > 0 &&
      !fragmentIdsThisRun.includes(node.fragmentId ?? "")) ||
    hasVisibleContent(node, scriptRunId)
  ) {
    return NOT_PENDING
  }
  return {
    isPending: true,
    hasPreviousContent: hasVisibleContent(node),
    label: findSkeletonLabel(node, scriptRunId),
  }
}

/**
 * Keep a previous run's visible content mounted under an incoming skeleton.
 *
 * Returns that content with `skeleton` attached as its pending skeleton, so the
 * frontend covers it after a grace period instead of unmounting it. Returns
 * `undefined` to let the skeleton replace the slot as usual.
 */
export function keepPreviousContentForSkeleton(
  existingNode: AppNode | undefined,
  skeleton: ElementNode
): AppNode | undefined {
  const anchor =
    existingNode instanceof TransientNode ? existingNode.anchor : existingNode
  // Only elements and flex containers render the overlay, so the skeleton
  // replaces other blocks, such as expanders or tabs.
  if (
    !(
      anchor instanceof ElementNode ||
      (anchor instanceof BlockNode && anchor.deltaBlock.flexContainer)
    )
  ) {
    return undefined
  }
  const waitsForContent =
    // The slot already waits for content; keep waiting under the new skeleton.
    anchor.pendingSkeleton !== undefined ||
    (anchor.scriptRunId !== skeleton.scriptRunId && hasVisibleContent(anchor))
  if (!waitsForContent) {
    return undefined
  }
  const kept = anchor.withPendingSkeleton(skeleton)
  // Keep the slot's transient elements, such as a running spinner, which the
  // backend doesn't send again.
  return existingNode instanceof TransientNode
    ? new TransientNode(
        existingNode.scriptRunId,
        kept,
        existingNode.transientNodes,
        existingNode.deltaMsgReceivedAt
      )
    : kept
}
