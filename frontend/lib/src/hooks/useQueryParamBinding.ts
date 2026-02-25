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

import { useEffect } from "react"

import { WidgetStateManager, WidgetValueType } from "~lib/WidgetStateManager"

export interface QueryParamBindingOptions {
  /** How to serialize arrays in the URL ("comma" for comma-separated, "repeated" for ?key=a&key=b) */
  urlFormat?: "comma" | "repeated"
}

/**
 * Custom hook to register a widget's binding to a URL query parameter.
 *
 * This hook handles:
 * - Registering the binding on mount (if queryParamKey is provided)
 * - Unregistering the binding on unmount
 * - Re-registering if dependencies change
 *
 * @param widgetMgr - The WidgetStateManager instance
 * @param widgetId - The unique widget ID
 * @param queryParamKey - The query parameter key (null/undefined if not bound)
 * @param valueType - The widget value type (e.g., "bool_value", "string_value")
 * @param defaultValue - The widget's default value (for clearing URL when value equals default)
 * @param clearable - Whether the widget allows clearing to empty state.
 *   Widget components must explicitly pass this based on their UI behavior.
 * @param options - Optional configuration for URL format.
 *   Note: This object is included in the useEffect dependency array. Callers should
 *   memoize the options object (e.g., via useMemo) to avoid unnecessary effect re-runs.
 */
export function useQueryParamBinding(
  widgetMgr: WidgetStateManager,
  widgetId: string,
  queryParamKey: string | null | undefined,
  valueType: WidgetValueType,
  defaultValue: unknown,
  clearable: boolean,
  options?: QueryParamBindingOptions
): void {
  useEffect(() => {
    // Treat null and undefined the same - no binding
    if (!queryParamKey) {
      return
    }

    widgetMgr.registerQueryParamBinding(
      widgetId,
      queryParamKey,
      valueType,
      defaultValue,
      clearable,
      options?.urlFormat
    )

    return () => {
      widgetMgr.unregisterQueryParamBinding(widgetId)
    }
  }, [
    widgetMgr,
    widgetId,
    queryParamKey,
    valueType,
    defaultValue,
    clearable,
    options,
  ])
}
