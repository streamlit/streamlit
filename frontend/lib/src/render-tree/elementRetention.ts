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
 * Element retention keeps a displaced prior-run element mounted until the
 * current run re-emits it or finishes.
 *
 * A rerun that inserts output above a keyed element overwrites the element's
 * delta path before the element arrives one slot later. Instead of dropping the
 * overwritten node, the parent block keeps it in `BlockNode.retained`, which is
 * not delta-addressable. The renderer shows it hidden in its previous place, so
 * React keeps the instance until the same element ID reclaims it. Stale cleanup
 * removes entries that are never reclaimed.
 *
 * See specs/2026-07-19-delta-tree-element-retention/tech-spec.md.
 */

import { getElementId } from "~lib/util/utils"

import type { AppNode } from "./AppNode.interface"
import { BlockNode } from "./BlockNode"
import { ElementNode } from "./ElementNode"
import { TransientNode } from "./TransientNode"

/** A displaced prior-run element kept mounted next to a block's children. */
export interface RetainedElement {
  /** The displaced node, rendered as-is until it is reclaimed or swept. */
  readonly node: ElementNode
  /** The node's element ID, used to reclaim it. */
  readonly id: string
  /**
   * The canonical index this entry renders in front of. Values at or past
   * `children.length` render after the last child.
   */
  readonly before: number
}

/**
 * Element types that must not stay mounted while hidden: toasts are owned by
 * the toast queue and never swept as stale, media would keep playing, and
 * capture inputs would keep their device active.
 */
const NON_RETAINABLE_ELEMENT_TYPES: ReadonlySet<string> = new Set([
  "toast",
  "audio",
  "video",
  "cameraInput",
  "audioInput",
])

/** The element ID of a node that may be retained, or undefined. */
function getRetainableId(node: AppNode | undefined): string | undefined {
  if (
    !(node instanceof ElementNode) ||
    node.element.hasOneShotEffect === true ||
    NON_RETAINABLE_ELEMENT_TYPES.has(node.element.type ?? "")
  ) {
    return undefined
  }
  return getElementId(node.element)
}

/**
 * Whether React keeps the component instance when `next` replaces `prev` at
 * the same index. Mirrors the keys assigned by `RenderNodeVisitor`: element and
 * block IDs when present, otherwise the sibling index.
 */
function keepsReactInstance(prev: AppNode, next: AppNode): boolean {
  if (prev instanceof ElementNode && next instanceof ElementNode) {
    return getElementId(prev.element) === getElementId(next.element)
  }
  if (prev instanceof BlockNode && next instanceof BlockNode) {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- blank block id means unset
    return (prev.deltaBlock.id || "") === (next.deltaBlock.id || "")
  }
  return false
}

/**
 * Inserts `entries` in front of the first entry anchored at or after their
 * shared `before`, keeping `retained` ordered by `before`.
 */
function insertInOrder(
  retained: readonly RetainedElement[],
  entries: readonly RetainedElement[]
): readonly RetainedElement[] {
  if (entries.length === 0) {
    return retained
  }
  const { before } = entries[0]
  const position = retained.findIndex(entry => entry.before >= before)
  const at = position === -1 ? retained.length : position
  return [...retained.slice(0, at), ...entries, ...retained.slice(at)]
}

/**
 * Returns the retained entries of a block after `next` is written at child
 * `index`, replacing `prev` (undefined for an append).
 *
 * 1. A retained entry with the incoming element ID is reclaimed (removed): the
 *    incoming node takes over its React key.
 * 2. If React keeps the instance at this slot, nothing else changes.
 * 3. Otherwise the incoming node is a fresh insertion. Entries rendered in
 *    front of this slot move behind it, and `prev` joins them if it is a
 *    retainable element from a previous run.
 *
 * Writes that involve a TransientNode leave retention unchanged.
 */
export function getRetainedAfterWrite({
  retained,
  index,
  prev,
  next,
  scriptRunId,
}: {
  retained: readonly RetainedElement[]
  index: number
  prev: AppNode | undefined
  next: AppNode
  scriptRunId: string
}): readonly RetainedElement[] {
  if (prev instanceof TransientNode || next instanceof TransientNode) {
    return retained
  }
  // Fast path for most writes: nothing is retained yet and the occupant can't
  // become retained.
  if (
    retained.length === 0 &&
    !(prev instanceof ElementNode && prev.scriptRunId !== scriptRunId)
  ) {
    return retained
  }

  const nextId =
    next instanceof ElementNode ? getElementId(next.element) : undefined
  let entries = retained
  if (nextId !== undefined && retained.some(entry => entry.id === nextId)) {
    entries = retained.filter(entry => entry.id !== nextId)
  }

  if (prev !== undefined && keepsReactInstance(prev, next)) {
    return entries
  }

  // An element that moved earlier leaves a stale copy further down. If that copy
  // is displaced it can be retained too; it renders behind the current copy,
  // so render dedup ignores it. Skip copies whose ID is already retained to
  // keep one entry per ID.
  const prevId = getRetainableId(prev)
  const displaced =
    prev instanceof ElementNode &&
    prevId !== undefined &&
    prevId !== nextId &&
    prev.scriptRunId !== scriptRunId &&
    !entries.some(entry => entry.id === prevId)
      ? [{ node: prev, id: prevId, before: index + 1 }]
      : []

  const moved = entries
    .filter(entry => entry.before === index)
    .map(entry => ({ ...entry, before: index + 1 }))
  if (moved.length > 0) {
    entries = entries.filter(entry => entry.before !== index)
  }

  return insertInOrder(entries, [...moved, ...displaced])
}

/**
 * Shifts entries anchored after `index` by one. Used when a transient node is
 * inserted in front of the child at `index`, moving later children down.
 */
export function shiftRetainedAfter(
  retained: readonly RetainedElement[],
  index: number
): readonly RetainedElement[] {
  if (!retained.some(entry => entry.before > index)) {
    return retained
  }
  return retained.map(entry =>
    entry.before > index ? { ...entry, before: entry.before + 1 } : entry
  )
}

/**
 * Returns the retained entries of a block after some of its children were
 * removed. `keptChildren[i]` tells whether old child `i` survived. Entries
 * rejected by `keepEntry` are dropped, and the rest are re-anchored to the
 * surviving children. Returns `retained` itself when nothing changed.
 */
export function getRetainedAfterRemoval(
  retained: readonly RetainedElement[],
  keptChildren: readonly boolean[],
  keepEntry: (entry: RetainedElement) => boolean
): readonly RetainedElement[] {
  if (retained.length === 0) {
    return retained
  }

  // survivorsBefore[i] is the number of surviving children with index < i.
  const survivorsBefore = [0]
  let survivors = 0
  for (const kept of keptChildren) {
    if (kept) {
      survivors += 1
    }
    survivorsBefore.push(survivors)
  }

  let changed = false
  const result: RetainedElement[] = []
  for (const entry of retained) {
    if (!keepEntry(entry)) {
      changed = true
      continue
    }
    const before = survivorsBefore[Math.min(entry.before, keptChildren.length)]
    if (before === entry.before) {
      result.push(entry)
    } else {
      changed = true
      result.push({ ...entry, before })
    }
  }
  return changed ? result : retained
}
