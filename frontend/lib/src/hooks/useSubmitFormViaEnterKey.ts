/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { useCallback } from "react"

import { WidgetStateManager } from "~lib/WidgetStateManager"
import { isEnterKeyPressed } from "~lib/util/inputUtils"

export type SubmitFormKeyboardEvent = Pick<
  React.KeyboardEvent<HTMLElement>,
  "metaKey" | "ctrlKey" | "keyCode" | "key" | "nativeEvent" | "preventDefault"
>

/**
 * Will return a memoized function that will call commitWidgetValue and submit the form
 * if the Enter key (+ optionally the command key) is pressed.
 *
 * @param formId of the form to submit
 * @param commitWidgetValue callback to call
 * @param callCommitWidgetValue whether to call commitWidgetValue
 * @param widgetMgr used to handle form submission
 * @param fragmentId
 * @param requireCommandKey if true, the metaKey or ctrlKey must be pressed to trigger the callback
 * @returns memoized callback
 */
export default function useSubmitFormViaEnterKey(
  formId: string,
  commitWidgetValue: () => void,
  callCommitWidgetValue: boolean,
  widgetMgr: WidgetStateManager,
  fragmentId?: string,
  requireCommandKey = false
): (e: SubmitFormKeyboardEvent) => void {
  return useCallback(
    (e: SubmitFormKeyboardEvent): void => {
      const isCommandKeyPressed = requireCommandKey
        ? e.metaKey || e.ctrlKey
        : true

      if (!isEnterKeyPressed(e) || !isCommandKeyPressed) {
        return
      }

      e.preventDefault()
      if (callCommitWidgetValue) {
        commitWidgetValue()
      }

      if (widgetMgr.allowFormEnterToSubmit(formId)) {
        widgetMgr.submitForm(formId, fragmentId)
      }
    },
    [
      formId,
      fragmentId,
      callCommitWidgetValue,
      commitWidgetValue,
      widgetMgr,
      requireCommandKey,
    ]
  )
}
