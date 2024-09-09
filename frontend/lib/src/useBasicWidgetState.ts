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

// Interface for a proto that has a .formId
interface ValueElementProtoInterface {
  formId: string
}

export interface UseValueWSourceArgs<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterface // Proto for this widget.
> {
  // Important: these callback functions need to have stable references! So
  // either declare them at the module level or wrap in useCallback.
  getStateFromWidgetMgr: (wm: WidgetStateManager, el: P) => T | undefined
  getDefaultState: (wm: WidgetStateManager, el: P) => T
  updateWidgetMgrState: (
    el: P,
    wm: WidgetStateManager,
    vws: ValueWSource<T>,
    fragmentId?: string
  ) => void
  element: P
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

/**
 * A React hook that makes the simplest kinds of widgets very easy to implement.
 * Use the clientState version when the widget does not have a .setValue on its
 * proto.
 */
export function useBasicWidgetClientState<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterface // Proto for this widget.
>({
  getStateFromWidgetMgr,
  getDefaultState,
  updateWidgetMgrState,
  element,
  widgetMgr,
  fragmentId,
}: UseValueWSourceArgs<T, P>): [
  T,
  Dispatch<SetStateAction<ValueWSource<T> | null>>
] {
  const [currentValue, setCurrentValue] = useState<T>(() => {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value.
    return (
      getStateFromWidgetMgr(widgetMgr, element) ??
      getDefaultState(widgetMgr, element)
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
    updateWidgetMgrState(element, widgetMgr, nextValueWSource, fragmentId)
  }, [nextValueWSource, updateWidgetMgrState, element, widgetMgr, fragmentId])

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  const onFormCleared = useCallback((): void => {
    setNextValueWSource({
      value: getDefaultState(widgetMgr, element),
      fromUi: true,
    })
  }, [setNextValueWSource, element, getDefaultState, widgetMgr])

  // Manage our form-clear event handler.
  useFormClearHelper({ widgetMgr, element, onFormCleared })

  return [currentValue, setNextValueWSource]
}

// Interface for a proto that has a .value, .setValue, and .formId
interface ValueElementProtoInterfaceWithSetValue<T>
  extends ValueElementProtoInterface {
  value?: T
  setValue: boolean
}

export interface UseValueWSourceArgsWithSetValue<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterfaceWithSetValue<T> // Proto for this widget.
> extends Omit<UseValueWSourceArgs<T, P>, "getDefaultState"> {
  // Important: these callback functions need to have stable references! So
  // either declare them at the module level or wrap in useCallback.
  getDefaultStateFromProto: (el: P) => T
  getCurrStateFromProto: (el: P) => T
}

/**
 * A React hook that makes the simplest kinds of widgets very easy to implement.
 */
export function useBasicWidgetState<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterfaceWithSetValue<T> // Proto for this widget.
>({
  getStateFromWidgetMgr,
  getDefaultStateFromProto,
  getCurrStateFromProto,
  updateWidgetMgrState,
  element,
  widgetMgr,
  fragmentId,
}: UseValueWSourceArgsWithSetValue<T, P>): [
  T,
  Dispatch<SetStateAction<ValueWSource<T> | null>>
] {
  const getDefaultState = useCallback<(wm: WidgetStateManager, el: P) => T>(
    (wm, el) => {
      return getDefaultStateFromProto(el)
    },
    [getDefaultStateFromProto]
  )

  const [currentValue, setNextValueWSource] = useBasicWidgetClientState({
    getStateFromWidgetMgr,
    getDefaultState,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  })

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

  return [currentValue, setNextValueWSource]
}
