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
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react"

import { useFormClearHelper } from "~lib/components/widgets/Form"
import { isNullOrUndefined } from "~lib/util/utils"
import { Source, WidgetStateManager } from "~lib/WidgetStateManager"

export type ValueWithSource<T> = {
  value: T
} & Source

// Interface for a proto that has a .formId
interface ValueElementProtoInterface {
  formId: string
}

interface BaseArgs<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterface, // Proto for this widget.
> {
  // Important: these callback functions need to have stable references! So
  // either declare them at the module level or wrap in useCallback.
  getStateFromWidgetMgr: (wm: WidgetStateManager, el: P) => T | undefined
  updateWidgetMgrState: (
    el: P,
    wm: WidgetStateManager,
    vws: ValueWithSource<T>,
    fragmentId?: string
  ) => void
  element: P
  widgetMgr: WidgetStateManager
  fragmentId?: string
  onFormCleared?: () => void
}

export interface UseBasicWidgetClientStateArgs<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterface, // Proto for this widget.
> extends BaseArgs<T, P> {
  // Important: these callback functions need to have stable references! So
  // either declare them at the module level or wrap in useCallback.
  getDefaultState: (wm: WidgetStateManager, el: P) => T
}

/**
 * A React hook that makes the simplest kinds of widgets very easy to implement.
 * Use the clientState version when the widget does not have a .setValue on its
 * proto, otherwise utilize `useBasicWidgetState`.
 */
export function useBasicWidgetClientState<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterface, // Proto for this widget.
>({
  getStateFromWidgetMgr,
  getDefaultState,
  updateWidgetMgrState,
  element,
  widgetMgr,
  fragmentId,
  onFormCleared,
}: UseBasicWidgetClientStateArgs<T, P>): [
  T,
  Dispatch<SetStateAction<ValueWithSource<T> | null>>,
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
  //   called setNextValueWithSource). And then it's immediately set to null
  //   internally.
  const [nextValueWithSource, setNextValueWithSource] =
    useState<ValueWithSource<T> | null>({
      value: currentValue,
      fromUi: false,
    })

  // When someone calls setNextValueWithSource, update internal state and tell
  // widget manager to update its state too.
  useEffect(() => {
    if (isNullOrUndefined(nextValueWithSource)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO: Do not set state in effect
    setNextValueWithSource(null) // Clear "event".

    setCurrentValue(nextValueWithSource.value)
    updateWidgetMgrState(element, widgetMgr, nextValueWithSource, fragmentId)
  }, [
    nextValueWithSource,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  ])

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  const handleFormCleared = useCallback((): void => {
    setNextValueWithSource({
      value: getDefaultState(widgetMgr, element),
      fromUi: true,
    })
    onFormCleared?.()
  }, [
    setNextValueWithSource,
    element,
    getDefaultState,
    widgetMgr,
    onFormCleared,
  ])

  // Manage our form-clear event handler.
  useFormClearHelper({ widgetMgr, element, onFormCleared: handleFormCleared })

  return [currentValue, setNextValueWithSource]
}

// Interface for a proto that has a setValue, and .formId
interface ValueElementProtoInterfaceWithSetValue extends ValueElementProtoInterface {
  setValue: boolean
}

export interface UseBasicWidgetStateArgs<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterfaceWithSetValue, // Proto for this widget.
> extends BaseArgs<T, P> {
  // Important: these callback functions need to have stable references! So
  // either declare them at the module level or wrap in useCallback.
  getDefaultStateFromProto: (el: P) => T
  getCurrStateFromProto: (el: P) => T
}

/**
 * A React hook that makes the simplest kinds of widgets very easy to implement.
 *
 * This hook handles the standard widget state management pattern, including:
 * - Initializing from WidgetStateManager or default values
 * - Responding to setValue updates from session_state
 * - Handling form clearing for clear_on_submit forms
 *
 * Examples: TextInput, NumberInput, Checkbox, Slider, etc.
 */
export function useBasicWidgetState<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterfaceWithSetValue, // Proto for this widget.
>({
  getStateFromWidgetMgr,
  getDefaultStateFromProto,
  getCurrStateFromProto,
  updateWidgetMgrState,
  element,
  widgetMgr,
  fragmentId,
  onFormCleared,
}: UseBasicWidgetStateArgs<T, P>): [
  T,
  Dispatch<SetStateAction<ValueWithSource<T> | null>>,
] {
  const getDefaultState = useCallback<(wm: WidgetStateManager, el: P) => T>(
    (_wm, el) => {
      // If setValue is true, use the current value from the proto instead of default.
      // This handles the case where the backend has seeded a value (e.g., from URL params)
      // and we need to initialize with that value, not the default.
      if (el.setValue) {
        return getCurrStateFromProto(el)
      }

      // Also check if the proto has a non-default value even if setValue is false.
      // This handles React Strict Mode where setValue was cleared by the first mount
      // but the seeded value is still in element.value.
      const currValue = getCurrStateFromProto(el)
      const defaultValue = getDefaultStateFromProto(el)

      // For arrays, compare by value not reference. Also check for non-empty arrays.
      // Empty arrays should use defaultValue since they indicate uninitialized state.
      if (Array.isArray(currValue) && Array.isArray(defaultValue)) {
        // If currValue is empty, use defaultValue
        if (currValue.length === 0) {
          return defaultValue
        }
        // If currValue has different values than defaultValue, use currValue
        if (
          currValue.length !== defaultValue.length ||
          currValue.some((v, i) => v !== defaultValue[i])
        ) {
          return currValue
        }
        // Arrays are equal, return defaultValue
        return defaultValue
      }

      // For non-array values, use simple comparison
      if (
        currValue !== defaultValue &&
        currValue !== null &&
        currValue !== undefined
      ) {
        return currValue
      }

      return defaultValue
    },
    [getDefaultStateFromProto, getCurrStateFromProto]
  )

  const [currentValue, setNextValueWithSource] = useBasicWidgetClientState({
    getStateFromWidgetMgr,
    getDefaultState,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    onFormCleared,
  })

  // Respond to value changes via session_state. This is also set via an
  // "event", this time using the .setValue property of the proto.
  useEffect(() => {
    if (!element.setValue) return
    // eslint-disable-next-line react-hooks/immutability -- TODO: Update to match React best practices
    element.setValue = false // Clear "event".

    setNextValueWithSource({
      value: getCurrStateFromProto(element),
      fromUi: false,
    })
  }, [element, getCurrStateFromProto, setNextValueWithSource])

  return [currentValue, setNextValueWithSource]
}
