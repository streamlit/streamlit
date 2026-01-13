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
  /**
   * The widget's current value. Used for auto-correction when URL has invalid
   * values, and for determining whether to sync to URL (only non-default values
   * are synced).
   */
  currentValue: T
  /**
   * The widget's default value. Only values that differ from the default will
   * be synced to the URL. This keeps URLs clean by not including default values.
   */
  defaultValue: T
  /**
   * Optional equality function for comparing widget value to URL value.
   * Defaults to strict equality (===). Use a custom function for arrays/objects.
   */
  isEqual?: (a: T, b: T | undefined) => boolean
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
// Default equality function using strict equality
const defaultIsEqual = <T>(a: T, b: T | undefined): boolean => a === b

export function useQueryParamBinding<T>({
  elementId,
  serializer,
  deserializer,
  widgetMgr,
  queryParamKey,
  currentValue,
  defaultValue,
  isEqual = defaultIsEqual,
}: UseQueryParamBindingArgs<T>): UseQueryParamBindingResult<T> {
  // Widget is bound if queryParamKey is a non-empty string
  const isBound = Boolean(queryParamKey)
  const paramKey = queryParamKey || undefined

  // Track if we've already registered to avoid duplicate registrations
  const isRegisteredRef = useRef(false)
  // Track if we've already auto-corrected the URL
  const hasAutoCorrectedRef = useRef(false)

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

  // Auto-correct URL on mount if needed.
  // This handles:
  // 1. Invalid URL values that were corrected by the backend
  // 2. Default values in URL that should be cleared (keep URLs clean)
  useEffect(() => {
    // Skip if not bound, value is undefined, or already corrected
    if (
      !isBound ||
      currentValue === undefined ||
      hasAutoCorrectedRef.current
    ) {
      return
    }

    const urlValue = widgetMgr.getValueFromQueryParams<T>(elementId)
    // Check if the URL has the param at all (even if deserialization failed)
    const urlHasParam =
      paramKey !== undefined &&
      new URLSearchParams(window.location.search).has(paramKey)

    const isCurrentDefault = isEqual(currentValue, defaultValue)

    if (urlHasParam) {
      if (isCurrentDefault) {
        // Current value is default - remove the param from URL to keep it clean
        widgetMgr.clearQueryParamForWidget(elementId)
      } else if (urlValue === undefined || !isEqual(currentValue, urlValue)) {
        // URL value is invalid or differs from current - correct it
        widgetMgr.syncWidgetToQueryParams(elementId, currentValue)
      }
    }
    // Note: If URL doesn't have param and value is non-default, we don't sync
    // on initial load. This prevents cluttering URLs when navigating to pages.
    // Values only sync to URL when explicitly changed by the user.

    hasAutoCorrectedRef.current = true
  }, [
    isBound,
    currentValue,
    defaultValue,
    elementId,
    widgetMgr,
    isEqual,
    paramKey,
  ])

  // Get value from URL
  const getUrlValue = useCallback((): T | undefined => {
    if (!isBound) return undefined
    return widgetMgr.getValueFromQueryParams<T>(elementId)
  }, [elementId, isBound, widgetMgr])

  // Sync value to URL (only non-default values)
  const syncToUrl = useCallback(
    (value: T): void => {
      if (!isBound) return
      if (isEqual(value, defaultValue)) {
        // Value is default - remove from URL to keep it clean
        widgetMgr.clearQueryParamForWidget(elementId)
      } else {
        // Value differs from default - sync to URL
        widgetMgr.syncWidgetToQueryParams(elementId, value)
      }
    },
    [elementId, isBound, widgetMgr, defaultValue, isEqual]
  )

  return {
    isBound,
    paramKey,
    getUrlValue,
    syncToUrl,
  }
}
