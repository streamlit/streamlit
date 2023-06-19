/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
  useRef,
  useState,
  MutableRefObject,
  Dispatch,
  SetStateAction,
} from "react"

/**
 * A custom React Hook that extends useState by providing a mutable ref object
 * to track the current state value.
 *
 * @template T The type of the state value.
 * @param {T} initialState The initial state value.
 * @returns {[T, Dispatch<SetStateAction<T>>, MutableRefObject<T>]} A tuple containing the
 *   current state value, a function to update the state, and a mutable ref object.
 *
 * @example
 * // Usage inside a component:
 * const [count, setCount, countRef] = useStateRef(0);
 *
 * // Accessing the current state value:
 * console.log(count); // Output: 0
 * console.log(countRef.current); // Output: 0
 *
 * // Modifying the state value and updating the ref:
 * setCount(10);
 * console.log(count); // Output: 10
 * console.log(countRef.current); // Output: 10
 *
 * // Comparing previous and current state values:
 * const previousCount = useRef(countRef.current);
 * console.log(previousCount.current); // Output: 10
 * console.log(previousCount.current === countRef.current); // Output: true
 *
 * // Sharing the state value with other components:
 * <ChildComponent countRef={countRef} />
 */
export default function useStateRef<T>(
  initialState: T
): [T, Dispatch<SetStateAction<T>>, MutableRefObject<T>] {
  const [state, setState] = useState<T>(initialState)
  const ref = useRef<T>(initialState)
  ref.current = state

  return [state, setState, ref]
}
