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

import type { AppNode } from "./AppNode.interface"
import { BlockNode } from "./BlockNode"
import { ElementNode } from "./ElementNode"
import { TransientNode } from "./TransientNode"

/** Element types that hold a slot without being content a user waits for. */
const PLACEHOLDER_ELEMENT_TYPES = new Set(["skeleton", "empty"])

/**
 * Whether `node` contains visible content that satisfies `isMatch`.
 *
 * Visible content is any element other than a skeleton or an empty
 * placeholder. Transient elements, such as spinners, never count; only a
 * transient node's anchor does.
 */
function containsVisibleContent(
  node: AppNode | undefined,
  isMatch: (element: ElementNode) => boolean
): boolean {
  if (node instanceof ElementNode) {
    return (
      !PLACEHOLDER_ELEMENT_TYPES.has(node.element.type ?? "") && isMatch(node)
    )
  }
  if (node instanceof BlockNode) {
    return node.children.some(child => containsVisibleContent(child, isMatch))
  }
  if (node instanceof TransientNode) {
    return containsVisibleContent(node.anchor, isMatch)
  }
  return false
}

/** Whether `node` contains visible content from any run. */
function hasVisibleContent(node: AppNode | undefined): boolean {
  return containsVisibleContent(node, () => true)
}

/** Whether `node` contains visible content drawn by the run `scriptRunId`. */
export function hasVisibleContentFromRun(
  node: AppNode | undefined,
  scriptRunId: string
): boolean {
  return containsVisibleContent(
    node,
    element => element.scriptRunId === scriptRunId
  )
}

/**
 * Return the text of a spinner from the run `scriptRunId` that was created
 * inside a skeleton slot, so the skeleton can show it as its label.
 */
function findSkeletonLabel(
  node: AppNode | undefined,
  scriptRunId: string
): string | undefined {
  if (node instanceof BlockNode) {
    for (const child of node.children) {
      const label = findSkeletonLabel(child, scriptRunId)
      if (label !== undefined) {
        return label
      }
    }
    return undefined
  }
  if (node instanceof TransientNode) {
    const spinner = node.transientNodes.find(
      transient =>
        transient.scriptRunId === scriptRunId &&
        transient.element.spinner?.skeletonLabel === true
    )
    return (
      spinner?.element.spinner?.text ??
      findSkeletonLabel(node.anchor, scriptRunId)
    )
  }
  return undefined
}

/** How a loading block (`Block.loading`) renders its skeleton right now. */
export interface LoadingBlockState {
  /** Whether the block waits for its first visible element of this run. */
  isPending: boolean
  /**
   * Whether the block still holds a previous run's content. That content stays
   * mounted and is covered after a grace period; otherwise the skeleton shows
   * right away.
   */
  hasPreviousContent: boolean
  /** Spinner text to show on the skeleton. */
  label?: string
}

const NOT_PENDING: LoadingBlockState = {
  isPending: false,
  hasPreviousContent: false,
}

/**
 * Compute the skeleton state of `node` for the run `scriptRunId`.
 *
 * A loading block is pending while that run is in progress and has not drawn
 * any visible content into it. Once the run ends, the block shows whatever it
 * holds, so a fragment that draws nothing doesn't keep its skeleton.
 */
export function getLoadingBlockState(
  node: BlockNode,
  scriptRunId: string,
  isRunning: boolean
): LoadingBlockState {
  if (
    !node.deltaBlock.loading ||
    !isRunning ||
    node.scriptRunId !== scriptRunId ||
    hasVisibleContentFromRun(node, scriptRunId)
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
 * Decide how a skeleton element that arrives at a slot treats the slot's
 * current node.
 *
 * If the slot holds visible content from a previous run, that content stays
 * mounted with the skeleton attached as its pending skeleton, so the frontend
 * can cover it after a grace period instead of unmounting it. Returns the
 * node to set at the slot, or `undefined` if the skeleton should replace the
 * slot as usual.
 */
export function keepPreviousContentForSkeleton(
  existingNode: AppNode | undefined,
  skeleton: ElementNode
): AppNode | undefined {
  const anchor =
    existingNode instanceof TransientNode ? existingNode.anchor : existingNode
  if (!(anchor instanceof ElementNode || anchor instanceof BlockNode)) {
    return undefined
  }
  if (anchor.pendingSkeleton !== undefined) {
    // The slot already waits for content; keep waiting under the new skeleton.
    return anchor.withPendingSkeleton(skeleton)
  }
  if (anchor.scriptRunId === skeleton.scriptRunId) {
    return undefined
  }
  if (!hasVisibleContent(anchor)) {
    return undefined
  }
  return anchor.withPendingSkeleton(skeleton)
}
