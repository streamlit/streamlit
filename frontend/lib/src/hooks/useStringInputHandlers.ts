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
  Dispatch,
  RefObject,
  SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react"

import { ValueWithSource } from "~lib/hooks/useBasicWidgetState"
import useNativeInputValueChange from "~lib/hooks/useNativeInputValueChange"
import useOnInputChange, {
  OnInputChangeEventType,
} from "~lib/hooks/useOnInputChange"
import { reconcileInputDomValue } from "~lib/util/inputUtils"

interface UseStringInputHandlersProps {
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  disabled: boolean
  formId: string
  maxChars: number
  uiValue: string | null
  dirty: boolean
  setDirty: Dispatch<SetStateAction<boolean>>
  setUiValue: Dispatch<SetStateAction<string | null>>
  setValueWithSource: Dispatch<
    SetStateAction<ValueWithSource<string | null> | null>
  >
  setFocused: Dispatch<SetStateAction<boolean>>
  /** Optional additional function to run after each input change.
   * Use useCallback to prevent unnecessary re-renders.
   */
  additionalOnChangeAction?: () => void
}

interface UseStringInputHandlersResult {
  onChange: (e: OnInputChangeEventType) => void
  onBlur: () => void
  onFocus: () => void
  commitWidgetValue: (value?: string | null) => void
}

/**
 * Encapsulates the complete input lifecycle for string-based widgets
 * (TextInput, TextArea).
 *
 * Composes three concerns into a single hook:
 * 1. React synthetic onChange handling (via useOnInputChange)
 * 2. Native DOM event bridging for programmatic value changes (e.g. password
 *    manager autofill) that bypass React's synthetic event system
 * 3. Blur reconciliation that treats the DOM as the source of truth at
 *    commitment boundaries, catching any mutations that were missed
 */
export default function useStringInputHandlers({
  inputRef,
  disabled,
  formId,
  maxChars,
  uiValue,
  dirty,
  setDirty,
  setUiValue,
  setValueWithSource,
  setFocused,
  additionalOnChangeAction,
}: UseStringInputHandlersProps): UseStringInputHandlersResult {
  // 1. React synthetic onChange handler
  const onChange = useOnInputChange({
    formId,
    maxChars,
    setDirty,
    setUiValue,
    setValueWithSource,
    additionalAction: additionalOnChangeAction,
  })

  // 2. Commit helper - defined before the native bridge so it can be passed as
  //    onCommit. Uses a ref to avoid recreating the callback on every uiValue
  //    change, which would cause downstream handlers (onBlur, onKeyPress) to
  //    churn.
  const uiValueRef = useRef(uiValue)
  useLayoutEffect(() => {
    uiValueRef.current = uiValue
  }, [uiValue])

  const commitWidgetValue = useCallback(
    (valueToCommit?: string | null): void => {
      setDirty(false)
      setValueWithSource({
        value: valueToCommit ?? uiValueRef.current,
        fromUi: true,
      })
    },
    [setDirty, setValueWithSource]
  )

  // 3. Native DOM event bridge - catches programmatic value changes (e.g.
  //    password managers dispatching non-bubbling input/change events) and
  //    funnels them through the same onChange path, then immediately commits.
  const clearPendingNativeSync = useNativeInputValueChange({
    inputRef,
    disabled,
    uiValueRef,
    maxChars,
    onChange,
    onCommit: commitWidgetValue,
  })

  // 4. Blur reconciliation
  const onBlur = useCallback((): void => {
    // Cancel any pending native change-event commit — blur already handles
    // the commit, and we don't want to double-commit.
    clearPendingNativeSync()
    // Password managers can programmatically set the input value without
    // dispatching an event that React/BaseWeb picks up. Always check the DOM
    // value on blur -- it represents what the user actually sees, regardless
    // of whether React state is dirty.
    const reconciliationResult = reconcileInputDomValue(
      inputRef.current,
      uiValueRef.current ?? "",
      maxChars
    )

    if (reconciliationResult.status === "rejected") {
      // The programmatic DOM value was rejected, but the user may have
      // typed a valid value before the injection. Commit it so it isn't lost.
      if (dirty) {
        commitWidgetValue()
      }
      setFocused(false)
      return
    }

    if (reconciliationResult.status === "changed") {
      setUiValue(reconciliationResult.domValue)
      commitWidgetValue(reconciliationResult.domValue)
    } else if (dirty) {
      commitWidgetValue()
    }

    setFocused(false)
  }, [
    clearPendingNativeSync,
    commitWidgetValue,
    dirty,
    inputRef,
    maxChars,
    setFocused,
    setUiValue,
  ])

  const onFocus = useCallback((): void => {
    setFocused(true)
  }, [setFocused])

  return { onChange, onBlur, onFocus, commitWidgetValue }
}
