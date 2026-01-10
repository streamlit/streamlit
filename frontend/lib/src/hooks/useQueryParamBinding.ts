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

import { useCallback, useEffect, useRef } from "react"

import {
  QueryParamDeserializer,
  QueryParamSerializer,
} from "~lib/queryParamSerializers"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface UseQueryParamBindingArgs<T> {
  /** The widget's element ID */
  elementId: string
  /** Serializer function to convert widget value to query param string(s) */
  serializer: QueryParamSerializer<T>
  /** Deserializer function to convert query param string(s) to widget value */
  deserializer: QueryParamDeserializer<T>
  /** The WidgetStateManager instance */
  widgetMgr: WidgetStateManager
  /**
   * The query parameter key from the widget proto (e.g., element.queryParamKey).
   * If set (non-null, non-empty string), the widget binds to this URL query parameter.
   * Protobuf generates this as string | null | undefined for optional fields.
   */
  queryParamKey?: string | null
}

export interface UseQueryParamBindingResult<T> {
  /** Whether this widget is bound to a query parameter */
  isBound: boolean
  /** The query parameter key, or undefined if not bound */
  paramKey: string | undefined
  /** Get the initial value from the URL if present */
  getUrlValue: () => T | undefined
  /** Sync the widget's current value to the URL */
  syncToUrl: (value: T) => void
}

/**
 * A React hook that manages query parameter binding for widgets.
 *
 * This hook:
 * 1. Checks if queryParamKey is provided (via bind="query_params")
 * 2. If bound, registers the binding with WidgetStateManager
 * 3. Provides utilities for getting initial URL values and syncing changes
 *
 * Usage:
 * ```tsx
 * const { isBound, getUrlValue, syncToUrl } = useQueryParamBinding({
 *   elementId: element.id,
 *   serializer: serializeBool,
 *   deserializer: deserializeBool,
 *   widgetMgr,
 *   queryParamKey: element.queryParamKey,
 * })
 *
 * // Get initial value from URL (call once during initialization)
 * const urlValue = isBound ? getUrlValue() : undefined
 *
 * // When widget value changes
 * if (isBound) {
 *   syncToUrl(newValue)
 * }
 * ```
 */
export function useQueryParamBinding<T>({
  elementId,
  serializer,
  deserializer,
  widgetMgr,
  queryParamKey,
}: UseQueryParamBindingArgs<T>): UseQueryParamBindingResult<T> {
  // Widget is bound if queryParamKey is a non-empty string
  const isBound = Boolean(queryParamKey)
  const paramKey = queryParamKey || undefined

  // Track if we've already registered to avoid duplicate registrations
  const isRegisteredRef = useRef(false)

  // Register/unregister the binding
  useEffect(() => {
    if (!isBound || !paramKey || isRegisteredRef.current) {
      return
    }

    widgetMgr.registerQueryParamBinding({
      widgetId: elementId,
      paramKey,
      serializer,
      deserializer,
    })
    isRegisteredRef.current = true

    return (): void => {
      widgetMgr.unregisterQueryParamBinding(elementId)
      isRegisteredRef.current = false
    }
  }, [elementId, paramKey, isBound, serializer, deserializer, widgetMgr])

  // Get value from URL
  const getUrlValue = useCallback((): T | undefined => {
    if (!isBound) return undefined
    return widgetMgr.getValueFromQueryParams<T>(elementId)
  }, [elementId, isBound, widgetMgr])

  // Sync value to URL
  const syncToUrl = useCallback(
    (value: T): void => {
      if (!isBound) return
      widgetMgr.syncWidgetToQueryParams(elementId, value)
    },
    [elementId, isBound, widgetMgr]
  )

  return {
    isBound,
    paramKey,
    getUrlValue,
    syncToUrl,
  }
}
