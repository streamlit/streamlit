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

/**
 * TreeWalker filter that accepts elements reachable with Tab. Rejects:
 * - negative tabIndex, `disabled`, or `hidden` elements
 * - elements invisible via display:none / visibility:hidden ancestors
 * - anything inside an `inert` or `aria-hidden="true"` subtree (pruned
 *   entirely). rc-overflow hides overflowed items with opacity:0 plus
 *   aria-hidden, which checkVisibility still reports as visible.
 *
 * Uses document order, not tab order (positive tabIndex is not visited
 * first). That is fine for header-bar routing, where no neighbor uses a
 * positive tabIndex, but don't reuse this as a general tab-order utility.
 */
function acceptTabbableNode(node: Node): number {
  if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP
  if (node.tabIndex < 0) return NodeFilter.FILTER_SKIP
  if ("disabled" in node && (node as HTMLButtonElement).disabled)
    return NodeFilter.FILTER_SKIP
  // `hidden` is `true` or `"until-found"` when set; both hide the node.
  if (node.hidden !== false) return NodeFilter.FILTER_SKIP
  if (node.closest("[inert], [aria-hidden='true']"))
    return NodeFilter.FILTER_REJECT
  if (
    "checkVisibility" in node &&
    !node.checkVisibility({ visibilityProperty: true })
  )
    return NodeFilter.FILTER_SKIP
  return NodeFilter.FILTER_ACCEPT
}

/** Focus the next tabbable element in document order after `fromElement`. */
export function focusNextTabbable(fromElement: HTMLElement): void {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    { acceptNode: acceptTabbableNode }
  )
  walker.currentNode = fromElement
  const next = walker.nextNode() as HTMLElement | null
  next?.focus()
}

/** Focus the previous tabbable element in document order before `fromElement`. */
export function focusPrevTabbable(fromElement: HTMLElement): void {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    { acceptNode: acceptTabbableNode }
  )
  walker.currentNode = fromElement
  const prev = walker.previousNode() as HTMLElement | null
  prev?.focus()
}
