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

function isTabbable(node: Node): number {
  if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP
  if (node.tabIndex < 0) return NodeFilter.FILTER_SKIP
  if ("disabled" in node && (node as HTMLButtonElement).disabled)
    return NodeFilter.FILTER_SKIP
  if (node.hidden) return NodeFilter.FILTER_SKIP
  if (node.closest("[inert]")) return NodeFilter.FILTER_SKIP
  return NodeFilter.FILTER_ACCEPT
}

/** Focus the next tabbable element in document order after `fromElement`. */
export function focusNextTabbable(fromElement: HTMLElement): void {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    { acceptNode: isTabbable }
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
    { acceptNode: isTabbable }
  )
  walker.currentNode = fromElement
  const prev = walker.previousNode() as HTMLElement | null
  prev?.focus()
}
