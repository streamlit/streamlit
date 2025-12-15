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

import { useCallback, useEffect, useRef } from "react"

import { getKeyFromId } from "~lib/components/core/Block/utils"
import {
  extractQueryParamName,
  isQueryParamKey,
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
}

export interface UseQueryParamBindingResult<T> {
  /** Whether this widget is bound to a query parameter */
  isBound: boolean
  /** The query parameter key (without "?" prefix), or undefined if not bound */
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
 * 1. Detects if the widget's key starts with "?" (indicating query param binding)
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
}: UseQueryParamBindingArgs<T>): UseQueryParamBindingResult<T> {
  // Extract user key from element ID
  const userKey = getKeyFromId(elementId)
  const isBound = isQueryParamKey(userKey)
  const paramKey =
    isBound && userKey ? extractQueryParamName(userKey) : undefined

  // Track if we've already registered to avoid duplicate registrations
  const isRegistered = useRef(false)

  // Register/unregister the binding
  useEffect(() => {
    if (!isBound || !paramKey || isRegistered.current) {
      return
    }

    widgetMgr.registerQueryParamBinding({
      widgetId: elementId,
      paramKey,
      serializer,
      deserializer,
    })
    isRegistered.current = true

    return (): void => {
      widgetMgr.unregisterQueryParamBinding(elementId)
      isRegistered.current = false
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
