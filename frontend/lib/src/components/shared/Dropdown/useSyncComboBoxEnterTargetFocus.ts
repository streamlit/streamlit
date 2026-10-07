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

import { useContext, useEffect, useRef } from "react"

import { ComboBoxStateContext, type Key } from "react-aria-components"

import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

/**
 * Keep ComboBox `selectionManager.focusedKey` on the Enter commit target while
 * the menu is open so `aria-activedescendant` names that row (#16841).
 *
 * React Aria clears `focusedKey` on every `inputValue` change. This effect
 * re-applies the target from inside ComboBox (where the collection is visible).
 * `setFocusedKey` no-ops until Virtualizer has registered the row, so we retry
 * on animation frames for up to one second.
 *
 * @param enterTargetKey - Option id Enter will commit, or null when none.
 * @param skipApply - When true, leave `focusedKey` alone (e.g. multiselect
 *   hover-end must not fall back to the first row after ArrowUp/Down).
 */
export function useSyncComboBoxEnterTargetFocus(
  enterTargetKey: Key | null,
  skipApply = false
): void {
  const state = useContext(ComboBoxStateContext)
  // Keep a live state pointer for rAF retries — focusedKey updates recreate
  // the context value, and a stale closure would call a detached manager.
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!state?.isOpen || skipApply) return

    let cancelled = false
    let rafId = 0
    const startedAt = performance.now()

    const userMovedAway = (): boolean => {
      const current = stateRef.current
      if (!current) return false
      const focused = current.selectionManager.focusedKey
      return (
        notNullOrUndefined(focused) &&
        notNullOrUndefined(enterTargetKey) &&
        String(focused) !== String(enterTargetKey)
      )
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
      if (userMovedAway()) return true
      // SelectionManager.setFocusedKey no-ops when the key is missing from the
      // collection, so it is safe to call before Virtualizer registers items.
      current.selectionManager.setFocusedKey(enterTargetKey)
      return focusedMatchesEnterTarget()
    }

    // ComboBox's effect clears focusedKey after this effect, and setFocusedKey
    // does nothing until Virtualizer has registered the row. Re-apply on
    // animation frames until either:
    // - the Enter target stays focused, or
    // - the user has arrowed to a different row.
    // Always queue at least one follow-up frame so we re-apply after ComboBox's
    // clear-on-inputValue effect. Do not depend on `state`: focus updates
    // replace that object and would pull arrow navigation back to the Enter
    // target.
    const schedule = (): void => {
      rafId = requestAnimationFrame(() => {
        if (cancelled) return
        if (applyEnterTargetFocus()) return
        if (performance.now() - startedAt < 1000) schedule()
      })
    }

    applyEnterTargetFocus()
    schedule()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [state?.isOpen, state?.inputValue, enterTargetKey, skipApply])
}
