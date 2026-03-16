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
  useMemo,
  useState,
} from "react"

import { useFormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import { isNullOrUndefined } from "~lib/util/utils"
import {
  DateType,
  Source,
  WidgetStateManager,
  WidgetValueType,
} from "~lib/WidgetStateManager"

import { useQueryParamBinding } from "./useQueryParamBinding"

export type ValueWithSource<T> = {
  value: T
} & Source

// Interface for a proto that has a .formId
interface ValueElementProtoInterface {
  formId: string
}

interface SharedArgs<
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
    fragmentId: string | undefined
  ) => void
  element: P
  widgetMgr: WidgetStateManager
  /**
   * Fragment context for reruns triggered by this widget interaction.
   *
   * This key is intentionally required (even when value is `undefined`) so
   * callsites must consciously thread fragment context through widget hooks.
   */
  fragmentId: string | undefined
}

interface UseBasicWidgetClientStateArgs<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterface, // Proto for this widget.
> extends SharedArgs<T, P> {
  // Important: these callback functions need to have stable references! So
  // either declare them at the module level or wrap in useCallback.
  getDefaultState: (wm: WidgetStateManager, el: P) => T
  onFormCleared?: () => void
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

// Interface for a proto that has a setValue, id, and .formId
interface ValueElementProtoInterfaceWithSetValue extends ValueElementProtoInterface {
  setValue: boolean
  id: string
}

/**
 * Explicit form-clear behavior contract for standard widget hooks.
 *
 * This is intentionally a discriminated union so each callsite must choose one
 * behavior and cannot "forget" to make the decision.
 */
type FormClearBehaviorArgs =
  | {
      // Widget only needs the standard default-value reset on form clear.
      formClearBehavior: "resetValueOnly"
    }
  | {
      // Widget needs additional local UI cleanup when the form is cleared.
      formClearBehavior: "resetValueAndRunCallback"
      onFormCleared: () => void
    }

/**
 * Configuration for query parameter binding integration.
 * When provided to useBasicWidgetState, the hook will automatically
 * register/unregister the widget's URL query parameter binding.
 */
export interface QueryParamBindingConfig {
  /** The URL query parameter key */
  paramKey: string
  /** The widget value type for URL conversion */
  valueType: WidgetValueType
  /**
   * Whether the widget allows clearing to empty state.
   * Required - widget components must explicitly pass this based on their UI behavior.
   */
  clearable: boolean
  /** How to serialize arrays in the URL ("comma" or "repeated") */
  urlFormat?: "comma" | "repeated"
  /**
   * The widget's default value expressed in URL-compatible format.
   * When provided, used instead of getDefaultStateFromProto(element) for
   * URL binding default comparison. Only needed when the widget's internal
   * state type differs from its URL representation (e.g., select_slider
   * stores indices internally but uses formatted option strings in URLs).
   */
  urlDefault?: string | number | boolean | string[] | number[] | null
  /** For date/time sliders: format microsecond timestamps as ISO strings in URLs */
  dateType?: DateType
}

interface UseBasicWidgetStateBaseArgs<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterfaceWithSetValue, // Proto for this widget.
> extends SharedArgs<T, P> {
  // Important: these callback functions need to have stable references! So
  // either declare them at the module level or wrap in useCallback.
  getDefaultStateFromProto: (el: P) => T
  getCurrStateFromProto: (el: P) => T
  /**
   * Optional query parameter binding configuration.
   * When provided, the hook will automatically register the widget
   * for URL query parameter synchronization.
   */
  queryParamBinding?: QueryParamBindingConfig
}

type UseBasicWidgetStateArgs<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterfaceWithSetValue, // Proto for this widget.
> = UseBasicWidgetStateBaseArgs<T, P> & FormClearBehaviorArgs

/**
 * A React hook that makes the simplest kinds of widgets very easy to implement.
 *
 * This hook handles the standard widget state management pattern, including:
 * - Initializing from WidgetStateManager or default values
 * - Responding to setValue updates from session_state
 * - Handling form clearing for clear_on_submit forms
 *
 * Critical API contract:
 * - Every widget callsite must explicitly declare form-clear intent via
 *   `formClearBehavior`.
 * - Every widget callsite must also explicitly pass `fragmentId` as a key,
 *   using either a fragment string or `undefined`.
 * - Use `resetValueOnly` for widgets that only need value reset.
 * - Use `resetValueAndRunCallback` when local ephemeral UI state must also be
 *   cleared (for example, validation errors, dirty flags, or in-progress input
 *   state that is not derived from the widget value).
 *
 * Examples: TextInput, NumberInput, Checkbox, Slider, etc.
 */
export function useBasicWidgetState<
  T, // Type of the value stored in WidgetStateManager.
  P extends ValueElementProtoInterfaceWithSetValue, // Proto for this widget.
>(
  args: UseBasicWidgetStateArgs<T, P>
): [T, Dispatch<SetStateAction<ValueWithSource<T> | null>>] {
  const {
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    queryParamBinding,
  } = args

  // Convert the explicit behavior declaration into the optional callback shape
  // expected by useBasicWidgetClientState.
  const formClearCallback =
    args.formClearBehavior === "resetValueAndRunCallback"
      ? args.onFormCleared
      : undefined

  const getDefaultState = useCallback<(wm: WidgetStateManager, el: P) => T>(
    (_wm, el) => {
      // Backend explicitly set a value (e.g., from URL params or session_state).
      // This handles both initial URL seeding and session_state updates.
      // On React Strict Mode remount, WidgetStateManager will have the value
      // (stored by the first mount's effect), so this path won't be reached.
      if (el.setValue) {
        return getCurrStateFromProto(el)
      }

      return getDefaultStateFromProto(el)
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
    onFormCleared: formClearCallback,
  })

  // Memoize values for useQueryParamBinding to prevent unnecessary effect re-runs.
  // When hasQueryParamBinding is false, fallback values are unused (hook early-returns).
  const hasQueryParamBinding = !isNullOrUndefined(queryParamBinding)

  // JSON.stringify provides value-based comparison for urlDefault arrays
  // (e.g., select_slider's ["green"] is a new reference each render).
  const urlDefaultKey =
    queryParamBinding?.urlDefault !== undefined
      ? JSON.stringify(queryParamBinding.urlDefault)
      : undefined
  const defaultValueForBinding = useMemo(() => {
    if (!hasQueryParamBinding) return undefined
    return queryParamBinding?.urlDefault !== undefined
      ? queryParamBinding.urlDefault
      : getDefaultStateFromProto(element)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- urlDefaultKey provides value-based comparison
  }, [hasQueryParamBinding, element, getDefaultStateFromProto, urlDefaultKey])

  const queryParamBindingOptions = useMemo(
    () =>
      hasQueryParamBinding
        ? {
            urlFormat: queryParamBinding?.urlFormat,
            dateType: queryParamBinding?.dateType,
          }
        : undefined,
    [
      hasQueryParamBinding,
      queryParamBinding?.urlFormat,
      queryParamBinding?.dateType,
    ]
  )

  // Query param binding registration (optional, integrated for convenience)
  useQueryParamBinding(
    widgetMgr,
    element.id,
    queryParamBinding?.paramKey ?? null,
    queryParamBinding?.valueType ?? "string_value",
    defaultValueForBinding,
    queryParamBinding?.clearable ?? false,
    queryParamBindingOptions
  )

  // Respond to value changes via session_state. This is also set via an
  // "event", this time using the .setValue property of the proto.
  useEffect(() => {
    if (!element.setValue) return
    element.setValue = false // Clear "event".

    setNextValueWithSource({
      value: getCurrStateFromProto(element),
      fromUi: false,
    })
  }, [element, getCurrStateFromProto, setNextValueWithSource])

  return [currentValue, setNextValueWithSource]
}
