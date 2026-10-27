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

import {
  type MutableRefObject,
  useContext,
  useLayoutEffect,
  useRef,
} from "react"

import { ComboBoxStateContext, type Key } from "react-aria-components"

import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

/** Poll while Virtualizer has not registered the Enter-target row yet. */
const MAX_SYNC_RETRY_MS = 5000
/** Survive RAC's post-paint focusedKey clear after inputValue changes. */
const STABLE_MATCH_FRAMES = 3

/**
 * Keep the active option on the Enter target so aria-activedescendant stays
 * set while the menu is open (#16841). React Aria clears focusedKey after
 * inputValue changes; rAF-retry until the row is registered (up to
 * {@link MAX_SYNC_RETRY_MS}). Hover may replace a hook-written key; an arrow
 * move may not (`skipApplyRef` / clear lastSyncedKeyRef).
 */
export function useSyncComboBoxEnterTargetFocus(
  enterTargetKey: Key | null,
  skipApplyRef?: MutableRefObject<boolean>
): void {
  const state = useContext(ComboBoxStateContext)
  const stateRef = useRef(state)
  stateRef.current = state
  const lastSyncedKeyRef = useRef<Key | null>(null)
  const prevFocusedKeyRef = useRef<Key | null>(null)

  const focusedKey = state?.selectionManager.focusedKey ?? null
  // String tokens (not booleans): restart when the mismatched/absent key changes.
  const absentFocusedKey =
    state?.isOpen === true &&
    notNullOrUndefined(focusedKey) &&
    !state.collection.getItem(focusedKey)
      ? String(focusedKey)
      : null
  const focusMismatchToken =
    state?.isOpen === true &&
    notNullOrUndefined(enterTargetKey) &&
    (isNullOrUndefined(focusedKey) ||
      String(focusedKey) !== String(enterTargetKey))
      ? `${String(enterTargetKey)}:${isNullOrUndefined(focusedKey) ? "" : String(focusedKey)}`
      : null
  const collectionVersion =
    state?.isOpen === true
      ? `${state.collection.size}:${String(state.collection.getFirstKey() ?? "")}`
      : ""

  // Arrow moved focus off the Enter target: drop lastSynced so returning to
  // that key is user-owned (focusMismatchToken must not snap to the first row).
  useLayoutEffect(() => {
    const prev = prevFocusedKeyRef.current
    prevFocusedKeyRef.current = focusedKey
    if (state?.isOpen !== true) {
      lastSyncedKeyRef.current = null
      return
    }
    if (
      notNullOrUndefined(prev) &&
      notNullOrUndefined(focusedKey) &&
      String(prev) !== String(focusedKey) &&
      String(focusedKey) !== String(enterTargetKey)
    ) {
      lastSyncedKeyRef.current = null
    }
  }, [focusedKey, state?.isOpen, enterTargetKey])

  useLayoutEffect(() => {
    if (state?.isOpen !== true) {
      lastSyncedKeyRef.current = null
      return
    }
    if (skipApplyRef?.current === true) {
      skipApplyRef.current = false
      return
    }

    let cancelled = false
    let rafId = 0
    let stableMatchFrames = 0
    const startedAt = performance.now()

    const shouldKeepCurrentFocus = (): boolean => {
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
      if (shouldKeepCurrentFocus()) return true
      if (
        notNullOrUndefined(enterTargetKey) &&
        !current.collection.getItem(enterTargetKey)
      ) {
        return false
      }
      current.selectionManager.setFocusedKey(enterTargetKey)
      if (focusedMatchesEnterTarget()) {
        lastSyncedKeyRef.current = enterTargetKey
        return true
      }
      return false
    }

    // Omit `state` from deps so focus updates do not reset arrow navigation.
    const schedule = (): void => {
      rafId = requestAnimationFrame(() => {
        if (cancelled) return
        if (shouldKeepCurrentFocus()) return
        if (applyEnterTargetFocus() && focusedMatchesEnterTarget()) {
          stableMatchFrames += 1
          if (stableMatchFrames >= STABLE_MATCH_FRAMES) return
        } else {
          stableMatchFrames = 0
        }
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
    absentFocusedKey,
    focusMismatchToken,
    collectionVersion,
  ])
}
