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

import { useState } from "react"

export const arrayComparator = <T>(
  previousValue: T[],
  currentValue: T[]
): boolean => {
  if (previousValue.length !== currentValue.length) {
    return false
  }

  return previousValue.every((value, index) =>
    Object.is(value, currentValue[index])
  )
}

/**
 * A custom hook that executes a callback when a value changes between renders.
 *
 * This hook follows React's best practices for adjusting state when props change
 * without using useEffect, as recommended in the React documentation:
 * @see {@link https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes | You Might Not Need an Effect}
 *
 * Instead of using an Effect to watch for changes and update state, this hook directly
 * compares the current and previous values during render, which is more efficient.
 *
 * @template T The type of the value being watched for changes
 * @param currentValue The current value to watch for changes
 * @param callback Function to execute when the value changes
 * @param comparator Optional custom comparison function to determine if the value has changed.
 *                   By default, uses Object.is() to detect changes.
 *                   If the comparator returns true, the callback will not be executed as
 *                   it indicates that the values are the same across renders.
 * @example
 * // Execute a function when a prop changes
 * useExecuteWhenChanged(
 *   () => {
 *     // This callback is executed when props.userId has changed.
 *     // Do something with the props.userId:
 *     loadUserData(props.userId);
 *   },
 *   [props.userId]
 * );
 */
export const useExecuteWhenChanged = <T extends unknown[]>(
  callback: () => void,
  currentValue: T,
  comparator: (previousValue: T, currentValue: T) => boolean = arrayComparator
): void => {
  const [previousValue, setPreviousValue] = useState<T>(currentValue)

  if (!comparator(previousValue, currentValue)) {
    setPreviousValue(currentValue)
    callback()
  }
}
