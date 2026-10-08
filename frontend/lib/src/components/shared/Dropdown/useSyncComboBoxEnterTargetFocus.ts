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
const MAX_SYNC_RETRY_MS = 1000

/**
 * Keep ComboBox `selectionManager.focusedKey` on the Enter commit target while
 * the menu is open so `aria-activedescendant` names that row (#16841).
 *
 * React Aria clears `focusedKey` on every `inputValue` change. This effect
 * re-applies the target from inside ComboBox (where the collection is visible).
 * `setFocusedKey` no-ops until Virtualizer has registered the row, so we retry
 * on animation frames for up to {@link MAX_SYNC_RETRY_MS}.
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

  useEffect(() => {
    if (!state?.isOpen) {
      lastSyncedKeyRef.current = null
      return
    }
    if (skipApplyRef?.current) {
      skipApplyRef.current = false
      return
    }

    let cancelled = false
    let rafId = 0
    const startedAt = performance.now()

    // True when the user has arrowed to a row this hook did not write.
    // React Aria clears focusedKey on each query change, so null is not a
    // user move. The last auto-synced key is not a user move either: hover
    // may replace it.
    const anotherRowIsFocused = (): boolean => {
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
      // Read first: once the user has arrowed elsewhere, do not overwrite.
      if (anotherRowIsFocused()) return true
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
    // focusedKey. Keep retrying until the Enter target stays focused, the user
    // has arrowed away, or the retry window ends. Do not list `state` as a
    // dependency: every focus update would restart the effect and pull arrow
    // navigation back to the Enter target.
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
  }, [state?.isOpen, state?.inputValue, enterTargetKey, skipApplyRef])
}
