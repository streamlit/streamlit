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
 * TreeWalker filter that accepts tabbable elements: non-negative tabIndex,
 * not disabled, not hidden, visible (checkVisibility gate for display:none /
 * visibility:hidden ancestors), and not inside an inert subtree (FILTER_REJECT
 * prunes the entire inert subtree so descendants are never visited).
 *
 * Note: this uses document order, not tab order — positive tabIndex values
 * are not visited first. This is sufficient for MainMenu's focus routing
 * (header-bar neighbors use no positive tabIndex) but should not be reused
 * as a general-purpose tab-order utility without sorting by tabIndex.
 */
function acceptTabbableNode(node: Node): number {
  if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP
  if (node.tabIndex < 0) return NodeFilter.FILTER_SKIP
  if ("disabled" in node && (node as HTMLButtonElement).disabled)
    return NodeFilter.FILTER_SKIP
  if (node.hidden) return NodeFilter.FILTER_SKIP
  if (node.closest("[inert]")) return NodeFilter.FILTER_REJECT
  if ("checkVisibility" in node && !node.checkVisibility())
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
