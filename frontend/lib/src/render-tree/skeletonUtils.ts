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
 * Whether `node` contains visible content. Transient elements, such as
 * spinners, never count; only a transient node's anchor does.
 */
function hasVisibleContent(node: AppNode | undefined): boolean {
  if (node instanceof ElementNode) {
    return !NON_CONTENT_ELEMENT_TYPES.has(node.element.type ?? "")
  }
  if (node instanceof BlockNode) {
    return node.children.some(hasVisibleContent)
  }
  if (node instanceof TransientNode) {
    return hasVisibleContent(node.anchor)
  }
  return false
}

/**
 * Return the node to set at a slot that receives `skeleton`, or `undefined` to
 * let the skeleton replace the slot as usual.
 *
 * Visible content from a previous run stays mounted with the skeleton attached
 * as its pending skeleton, so the frontend can cover it after a grace period
 * instead of unmounting it.
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
