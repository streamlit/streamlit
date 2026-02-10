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

import { Dispatch, RefObject, SetStateAction, useCallback } from "react"

import { ValueWithSource } from "~lib/hooks/useBasicWidgetState"

interface UseStringInputCommitOnBlurProps {
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  uiValue: string | null
  dirty: boolean
  maxChars: number
  setDirty: Dispatch<SetStateAction<boolean>>
  setUiValue: Dispatch<SetStateAction<string | null>>
  setValueWithSource: Dispatch<
    SetStateAction<ValueWithSource<string | null> | null>
  >
  setFocused: Dispatch<SetStateAction<boolean>>
}

interface UseStringInputCommitOnBlurResult {
  commitWidgetValue: (valueToCommit?: string | null) => void
  onBlur: () => void
}

/**
 * Shared commit + blur reconciliation logic for string-based inputs.
 *
 * This reconciles programmatic DOM value changes (e.g. password manager
 * autofill) that can bypass React change handlers, and commits them on blur.
 */
export default function useStringInputCommitOnBlur({
  inputRef,
  uiValue,
  dirty,
  maxChars,
  setDirty,
  setUiValue,
  setValueWithSource,
  setFocused,
}: UseStringInputCommitOnBlurProps): UseStringInputCommitOnBlurResult {
  const commitWidgetValue = useCallback(
    (valueToCommit: string | null = uiValue): void => {
      setDirty(false)
      setValueWithSource({ value: valueToCommit, fromUi: true })
    },
    [uiValue, setDirty, setValueWithSource]
  )

  const onBlur = useCallback((): void => {
    // Password managers can programmatically set the input value without
    // dispatching an event that React/BaseWeb picks up.
    const domValue = inputRef.current?.value ?? ""
    const currentUiValue = uiValue ?? ""

    if (!dirty && domValue !== currentUiValue) {
      if (maxChars !== 0 && domValue.length > maxChars) {
        setFocused(false)
        return
      }

      setUiValue(domValue)
      commitWidgetValue(domValue)
    } else if (dirty) {
      commitWidgetValue()
    }

    setFocused(false)
  }, [
    commitWidgetValue,
    dirty,
    inputRef,
    maxChars,
    setFocused,
    setUiValue,
    uiValue,
  ])

  return { commitWidgetValue, onBlur }
}
