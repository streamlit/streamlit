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

import { type MutableRefObject, useContext, useEffect, useRef } from "react"

import { ComboBoxStateContext, type Key } from "react-aria-components"

import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

/** Max time spent retrying setFocusedKey until Virtualizer registers the row. */
const MAX_SYNC_RETRY_MS = 3000

/**
 * Keep ComboBox `selectionManager.focusedKey` on the Enter commit target while
 * the menu is open so `aria-activedescendant` names that row (#16841).
 *
 * React Aria clears `focusedKey` on every `inputValue` change. This effect
 * re-applies the target from inside ComboBox (where the collection is visible).
 * `setFocusedKey` no-ops until Virtualizer has registered the row, so we retry
 * on animation frames for up to {@link MAX_SYNC_RETRY_MS}.
 *
 * Ownership rules (multiselect Enter prefers focusedKey over hover):
 * - A key this hook last wrote may be replaced when `enterTargetKey` changes
 *   (hover after typing).
 * - A key the user arrowed to must not be overwritten by sync or hover-end
 *   falling back to the first row (`skipApplyRef`).
 * - Do not clear `lastSyncedKeyRef` on skip: the preserved row is still
 *   hook-owned, so a later hover can replace it. Clearing it makes that row
 *   look like an arrow move and blocks the next hover sync.
 * - Restart when the focused key leaves the collection (multiselect commit),
 *   not on every filter membership change.
 *
 * @param enterTargetKey - Option id Enter will commit, or null when none.
 * @param skipApplyRef - When `.current` is true, leave `focusedKey` alone for
 *   this run and clear the flag (e.g. multiselect hover-end must not fall back
 *   to the first row after ArrowUp/Down). Set from an event handler, not render.
 */
export function useSyncComboBoxEnterTargetFocus(
  enterTargetKey: Key | null,
  skipApplyRef?: MutableRefObject<boolean>
): void {
  const state = useContext(ComboBoxStateContext)
  // Keep a live state pointer for rAF retries — focusedKey updates recreate
  // the context value, and a stale closure would call a detached manager.
  const stateRef = useRef(state)
  stateRef.current = state
  // Last key this hook successfully wrote. Hover (and other enterTargetKey
  // changes) may replace that auto-synced row; ArrowUp/Down to a different
  // row must not be overwritten.
  const lastSyncedKeyRef = useRef<Key | null>(null)
  // Multiselect Enter removes the committed option while the menu stays open.
  // enterTargetKey / inputValue often stay the same, so restart only when the
  // current focusedKey is missing from the collection — not on every filter
  // membership change (that cancelled in-flight retries and could overwrite a
  // hover-end-preserved row once skipApplyRef was spent).
  const focusedKey = state?.selectionManager.focusedKey ?? null
  const focusedKeyAbsent =
    state?.isOpen &&
    notNullOrUndefined(focusedKey) &&
    !state.collection.getItem(focusedKey)
      ? String(focusedKey)
      : null

  useEffect(() => {
    if (!state?.isOpen) {
      lastSyncedKeyRef.current = null
      return
    }
    if (skipApplyRef?.current) {
      // Keep lastSyncedKeyRef: the preserved focusedKey is still the hook's
      // last write (or an arrow row that already differs from it). Clearing
      // it would make a hover-synced row look like an arrow move and block
      // the next hover from updating activedescendant / Enter.
      skipApplyRef.current = false
      return
    }

    let cancelled = false
    let rafId = 0
    const startedAt = performance.now()

    // True when focusedKey is a listed row this hook did not write, so a retry
    // must leave it alone.
    // - null: React Aria cleared focus after a query change, so keep syncing
    // - same as the last key this hook wrote: a later hover may replace it
    // - missing from the collection: the row was removed (multiselect commit),
    //   so keep syncing
    const userMovedOffEnterTarget = (): boolean => {
      const current = stateRef.current
      if (!current) return false
      const focused = current.selectionManager.focusedKey
      if (
        isNullOrUndefined(focused) ||
        isNullOrUndefined(enterTargetKey) ||
        String(focused) === String(enterTargetKey)
      ) {
        return false
      }
      if (!current.collection.getItem(focused)) {
        return false
      }
      const lastSynced = lastSyncedKeyRef.current
      if (
        notNullOrUndefined(lastSynced) &&
        String(focused) === String(lastSynced)
      ) {
        return false
      }
      return true
    }

    const focusedMatchesEnterTarget = (): boolean => {
      const current = stateRef.current
      if (!current) return isNullOrUndefined(enterTargetKey)
      const focused = current.selectionManager.focusedKey
      return (
        isNullOrUndefined(enterTargetKey) ||
        (notNullOrUndefined(focused) &&
          String(focused) === String(enterTargetKey))
      )
    }

    const applyEnterTargetFocus = (): boolean => {
      const current = stateRef.current
      if (!current) return false
      // Read first: once focus sits on a row this hook did not write, stop.
      if (userMovedOffEnterTarget()) return true
      // SelectionManager.setFocusedKey no-ops when the key is missing from the
      // collection, so it is safe to call before Virtualizer registers items.
      current.selectionManager.setFocusedKey(enterTargetKey)
      if (focusedMatchesEnterTarget()) {
        lastSyncedKeyRef.current = enterTargetKey
        return true
      }
      return false
    }

    // Always schedule one more frame so this hook runs after ComboBox clears
    // focusedKey. Retry until:
    // - the Enter target stays focused;
    // - focus sits on a row this hook did not write; or
    // - the retry window ends.
    // `state` stays out of the dependency list: focus updates replace that
    // object and would pull arrow navigation back to the Enter target.
    const schedule = (): void => {
      rafId = requestAnimationFrame(() => {
        if (cancelled) return
        if (applyEnterTargetFocus()) return
        if (performance.now() - startedAt < MAX_SYNC_RETRY_MS) schedule()
      })
    }

    applyEnterTargetFocus()
    schedule()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [
    state?.isOpen,
    state?.inputValue,
    enterTargetKey,
    skipApplyRef,
    focusedKeyAbsent,
  ])
}
