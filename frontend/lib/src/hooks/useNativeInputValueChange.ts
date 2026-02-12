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
  MutableRefObject,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react"

import { OnInputChangeEventType } from "~lib/hooks/useOnInputChange"
import useTimeout from "~lib/hooks/useTimeout"
import { reconcileInputDomValue } from "~lib/util/inputUtils"

interface UseNativeInputValueChangeProps {
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  disabled: boolean
  uiValueRef: MutableRefObject<string | null>
  maxChars?: number
  onChange: (e: OnInputChangeEventType) => void
  /** Called after onChange when a native value change is detected and accepted.
   * Use this to immediately commit the value to the widget manager, since
   * programmatic changes (e.g. password manager autofill) won't be followed
   * by a user-initiated blur or Enter press. */
  onCommit?: (value: string) => void
}

/**
 * Attaches native DOM listeners as a fallback for cases where third-party tools
 * (e.g. password managers) update input values through native events that React
 * might not observe.
 */
export default function useNativeInputValueChange({
  inputRef,
  disabled,
  uiValueRef,
  maxChars = 0,
  onChange,
  onCommit,
}: UseNativeInputValueChangeProps): () => void {
  const onChangeRef = useRef(onChange)
  const onCommitRef = useRef(onCommit)
  const pendingNativeSyncRef = useRef(false)
  /** True when the pending native event is a "change" event, which signals
   *  a completed value change (e.g. programmatic fill) rather than ongoing
   *  user typing. */
  const pendingChangeEventRef = useRef(false)

  useLayoutEffect(() => {
    onChangeRef.current = onChange
    onCommitRef.current = onCommit
  }, [onChange, onCommit])

  const handleDeferredNativeValueChange = useCallback((): void => {
    if (!pendingNativeSyncRef.current) {
      return
    }
    pendingNativeSyncRef.current = false
    const wasChangeEvent = pendingChangeEventRef.current
    pendingChangeEventRef.current = false

    const reconciliationResult = reconcileInputDomValue(
      inputRef.current,
      uiValueRef.current ?? "",
      maxChars
    )

    // Defer reconciliation until after the native event so React/BaseWeb has a
    // chance to process standard bubbling input events first.
    //
    // Timing note:
    // - handleNativeValueChange runs during the native "input"/"change" event
    //   and schedules this handler via a 0ms timeout.
    // - In the common case, React's synthetic onChange for the same event
    //   updates state, triggers a re-render, and the owner hook synchronously
    //   updates uiValueRef.current in layout effects before this timeout fires.
    // - If that happens, domValue and currentUiValue will be equal here and we
    //   intentionally no-op to avoid double-processing the same change.
    //
    // This relies on the assumption that React finishes handling the bubbling
    // event and runs layout effects in the same macrotask before the deferred
    // callback is dequeued, which holds for typical React 18 behavior but is
    // subtle enough that we document it explicitly for future maintainers.
    if (reconciliationResult.status === "same") {
      // React already processed the onChange for this event. For "input"
      // events (fired on each keystroke), the normal dirty→blur→commit flow
      // applies. For "change" events (fired by password managers after
      // completing a fill, or natively on blur), commit immediately since
      // there may not be a subsequent user-initiated blur.
      if (wasChangeEvent) {
        onCommitRef.current?.(reconciliationResult.domValue)
      }
      return
    }

    if (reconciliationResult.status === "rejected") {
      return
    }

    onChangeRef.current({ target: { value: reconciliationResult.domValue } })
    onCommitRef.current?.(reconciliationResult.domValue)
  }, [inputRef, maxChars, uiValueRef])

  const { clear: clearNativeSyncTimeout, restart: restartNativeSyncTimeout } =
    useTimeout(handleDeferredNativeValueChange, 0, { autoStart: false })

  const handleNativeValueChange = useCallback(
    (event: Event): void => {
      pendingNativeSyncRef.current = true
      pendingChangeEventRef.current =
        pendingChangeEventRef.current || event.type === "change"

      if (!event.bubbles) {
        // Non-bubbling events are invisible to React's synthetic event system,
        // so there's no risk of double-processing. Handle immediately rather
        // than deferring via timeout.
        handleDeferredNativeValueChange()
        return
      }

      restartNativeSyncTimeout()
    },
    [handleDeferredNativeValueChange, restartNativeSyncTimeout]
  )

  useEffect(() => {
    const el = inputRef.current
    if (!el || disabled) {
      return
    }

    // Capture phase so we still see events even if propagation is stopped.
    const listenerOptions: AddEventListenerOptions = { capture: true }

    el.addEventListener("input", handleNativeValueChange, listenerOptions)
    el.addEventListener("change", handleNativeValueChange, listenerOptions)

    return () => {
      el.removeEventListener("input", handleNativeValueChange, listenerOptions)
      el.removeEventListener(
        "change",
        handleNativeValueChange,
        listenerOptions
      )
      pendingNativeSyncRef.current = false
      clearNativeSyncTimeout()
    }
  }, [clearNativeSyncTimeout, disabled, handleNativeValueChange, inputRef])

  /** Clears any pending deferred reconciliation. Call from onBlur to prevent
   *  the change-event commit from double-committing when blur already handles
   *  the commit. */
  const clearPending = useCallback((): void => {
    pendingNativeSyncRef.current = false
    pendingChangeEventRef.current = false
    clearNativeSyncTimeout()
  }, [clearNativeSyncTimeout])

  return clearPending
}
