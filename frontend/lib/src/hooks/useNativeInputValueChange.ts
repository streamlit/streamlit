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
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react"

import { OnInputChangeEventType } from "~lib/hooks/useOnInputChange"
import useTimeout from "~lib/hooks/useTimeout"
import { rejectOverMaxChars } from "~lib/util/inputUtils"

interface UseNativeInputValueChangeProps {
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  disabled: boolean
  uiValue: string | null
  maxChars?: number
  onChange: (e: OnInputChangeEventType) => void
}

/**
 * Attaches native DOM listeners as a fallback for cases where third-party tools
 * (e.g. password managers) update input values through native events that React
 * might not observe.
 */
export default function useNativeInputValueChange({
  inputRef,
  disabled,
  uiValue,
  maxChars = 0,
  onChange,
}: UseNativeInputValueChangeProps): void {
  const uiValueRef = useRef(uiValue ?? "")
  const onChangeRef = useRef(onChange)
  const pendingNativeSyncRef = useRef(false)

  useLayoutEffect(() => {
    uiValueRef.current = uiValue ?? ""
    onChangeRef.current = onChange
  }, [onChange, uiValue])

  const handleDeferredNativeValueChange = useCallback((): void => {
    if (!pendingNativeSyncRef.current) {
      return
    }
    pendingNativeSyncRef.current = false

    const domValue = inputRef.current?.value ?? ""
    const currentUiValue = uiValueRef.current

    // Defer reconciliation until after the native event so React/BaseWeb has a
    // chance to process standard bubbling input events first.
    //
    // Timing note:
    // - handleNativeValueChange runs during the native "input"/"change" event
    //   and schedules this handler via a 0ms timeout.
    // - In the common case, React's synthetic onChange for the same event
    //   updates state, triggers a re-render, and the useLayoutEffect above
    //   synchronously updates uiValueRef.current before this timeout fires.
    // - If that happens, domValue and currentUiValue will be equal here and we
    //   intentionally no-op to avoid double-processing the same change.
    //
    // This relies on the assumption that React finishes handling the bubbling
    // event and runs layout effects in the same macrotask before the deferred
    // callback is dequeued, which holds for typical React 18 behavior but is
    // subtle enough that we document it explicitly for future maintainers.
    if (domValue === currentUiValue) {
      return
    }

    if (
      rejectOverMaxChars(inputRef.current, domValue, currentUiValue, maxChars)
    ) {
      return
    }

    onChangeRef.current({ target: { value: domValue } })
  }, [inputRef, maxChars])

  const { clear: clearNativeSyncTimeout, restart: restartNativeSyncTimeout } =
    useTimeout(handleDeferredNativeValueChange, 0)

  const handleNativeValueChange = useCallback(
    (event: Event): void => {
      pendingNativeSyncRef.current = true

      if (!event.bubbles) {
        // Non-bubbling events are invisible to React's synthetic event system,
        // so there's no risk of double-processing. Handle immediately rather
        // than deferring via timeout.
        handleDeferredNativeValueChange()
        return
      }

      clearNativeSyncTimeout()
      restartNativeSyncTimeout()
    },
    [
      clearNativeSyncTimeout,
      handleDeferredNativeValueChange,
      restartNativeSyncTimeout,
    ]
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
}
