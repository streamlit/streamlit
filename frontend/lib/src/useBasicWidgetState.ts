/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react"

import {
  Source,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
import { useFormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import { isNullOrUndefined } from "@streamlit/lib/src/util/utils"

export type ValueWSource<T> = {
  value: T
} & Source

interface ValueElementProtoInterface<T> {
  value?: T
  setValue: boolean
  formId: string
}

export interface UseValueWSourceArgs<
  T,
  P extends ValueElementProtoInterface<T>
> {
  getStateFromWidgetMgr: (wm: WidgetStateManager, el: P) => T | undefined
  getDefaultStateFromProto: (el: P) => T
  getCurrStateFromProto: (el: P) => T
  updateWidgetMgrState: (wm: WidgetStateManager, vws: ValueWSource<T>) => void
  element: P
  widgetMgr: WidgetStateManager
}

/**
 * A React hook that makes the simplest kinds of widgets very easy to
 * implement.
 */
export function useBasicWidgetState<
  T,
  P extends ValueElementProtoInterface<T>
>({
  getStateFromWidgetMgr,
  getDefaultStateFromProto,
  getCurrStateFromProto,
  updateWidgetMgrState,
  element,
  widgetMgr,
}: UseValueWSourceArgs<T, P>): [
  T,
  Dispatch<SetStateAction<ValueWSource<T> | null>>
] {
  const [currentValue, setCurrentValue] = useState<T>(() => {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    return (
      getStateFromWidgetMgr(widgetMgr, element) ??
      getDefaultStateFromProto(element)
    )
  })

  // This acts as an "event":
  // - It's null most of the time
  // - It only has a value the moment when the user calls setValue (internally
  //   called setNextValueWSource). And then it's immediately set to null
  //   internally.
  const [nextValueWSource, setNextValueWSource] =
    useState<ValueWSource<T> | null>({
      value: currentValue,
      fromUi: false,
    })

  // When someone calls setNextValueWSource, update internal state and tell
  // widget manager to update its state too.
  useEffect(() => {
    if (isNullOrUndefined(nextValueWSource)) return
    setNextValueWSource(null) // Clear "event".

    setCurrentValue(nextValueWSource.value)
    updateWidgetMgrState(widgetMgr, nextValueWSource)
  }, [nextValueWSource, setNextValueWSource, updateWidgetMgrState, widgetMgr])

  // Respond to value changes via session_state. This is also set via an
  // "event", this time using the .setValue property of the proto.
  useEffect(() => {
    if (!element.setValue) return
    element.setValue = false // Clear "event".

    setNextValueWSource({
      value: getCurrStateFromProto(element),
      fromUi: false,
    })
  }, [element, getCurrStateFromProto, setNextValueWSource])

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  const onFormCleared = useCallback((): void => {
    setNextValueWSource({
      value: getDefaultStateFromProto(element),
      fromUi: true,
    })
  }, [setNextValueWSource, element, getDefaultStateFromProto])

  // Manage our form-clear event handler.
  useFormClearHelper({ widgetMgr, element, onFormCleared })

  return [currentValue, setNextValueWSource]
}
