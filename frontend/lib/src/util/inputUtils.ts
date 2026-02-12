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

type EnterKeyEvent = Pick<
  React.KeyboardEvent<HTMLElement>,
  "key" | "keyCode" | "nativeEvent"
>

export type ReconcileInputDomValueResult =
  | { status: "same"; domValue: string; currentUiValue: string }
  | { status: "changed"; domValue: string; currentUiValue: string }
  | { status: "rejected"; domValue: string; currentUiValue: string }

/**
 * Checks whether `domValue` exceeds `maxChars`. When it does, the DOM input
 * element is immediately restored to `fallbackValue` so the user doesn't see
 * a rejected value lingering in the input.
 *
 * @returns `true` if the value was rejected (exceeded maxChars), `false`
 *          otherwise.
 */
export function rejectOverMaxChars(
  inputEl: HTMLInputElement | HTMLTextAreaElement | null,
  domValue: string,
  fallbackValue: string,
  maxChars: number
): boolean {
  if (maxChars !== 0 && domValue.length > maxChars) {
    if (inputEl) {
      inputEl.value = fallbackValue
    }
    return true
  }
  return false
}

/**
 * Compares current DOM value against the controlled UI value and classifies the
 * reconciliation result.
 */
export function reconcileInputDomValue(
  inputEl: HTMLInputElement | HTMLTextAreaElement | null,
  currentUiValue: string,
  maxChars: number
): ReconcileInputDomValueResult {
  const domValue = inputEl?.value ?? ""
  if (domValue === currentUiValue) {
    return { status: "same", domValue, currentUiValue }
  }

  if (rejectOverMaxChars(inputEl, domValue, currentUiValue, maxChars)) {
    return { status: "rejected", domValue, currentUiValue }
  }

  return { status: "changed", domValue, currentUiValue }
}

export function isEnterKeyPressed(event: EnterKeyEvent): boolean {
  const { keyCode, key } = event

  // Using keyCode as well due to some different behaviors on Windows
  // https://bugs.chromium.org/p/chromium/issues/detail?id=79407
  return (
    (key === "Enter" || keyCode === 13 || keyCode === 10) &&
    // Do not send the sentence being composed when Enter is typed into the IME.
    !(event.nativeEvent?.isComposing === true)
  )
}
