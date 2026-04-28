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

import { useEffect, useState } from "react"

/**
 * A custom hook that returns a debounced version of the input value.
 *
 * The debounced value will only update after the specified delay has passed
 * since the last time the input value changed. This can be useful for preventing
 * expensive operations from being triggered too frequently, such as API calls
 * or DOM updates that depend on rapidly changing values.
 *
 * @template T The type of the value being debounced
 * @param value The value to debounce
 * @param delay The delay in milliseconds before the debounced value updates
 * @returns The debounced value
 *
 * @example
 * const searchTerm = "user input";
 * const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
 *
 * // debouncedSearchTerm will only update 300ms after searchTerm stops changing
 * useEffect(() => {
 *   // Perform search with debouncedSearchTerm
 *   performSearch(debouncedSearchTerm);
 * }, [debouncedSearchTerm]);
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Update debounced value after delay
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Clear timeout if value changes (cleanup function)
    return () => {
      clearTimeout(timeoutId)
    }
  }, [value, delay])

  return debouncedValue
}
