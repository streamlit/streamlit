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
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

export type DOMRectKeys =
  | "bottom"
  | "height"
  | "left"
  | "right"
  | "top"
  | "width"
  | "x"
  | "y"

export interface UseResizeObserverOptions {
  /**
   * Debounce delay in milliseconds. When set, resize events will be debounced
   * to reduce the frequency of updates during rapid resizing (e.g., window drag).
   * Default is 0 (no debouncing, only requestAnimationFrame batching).
   */
  debounceMs?: number
}

/**
 * A hook that observes changes to the dimensions of a DOM element.
 *
 * @template T - The type of the HTML element being observed.
 * @param {DOMRectKeys[]} properties - The list of DOMRect properties to observe.
 * @param {React.DependencyList} [dependencies=[]] - An optional list of dependencies
 * that will cause the observer to be re-evaluated.
 * @param {UseResizeObserverOptions} [options={}] - Optional configuration.
 * @returns {{
 *   values: number[],
 *   elementRef: MutableRefObject<T | null>,
 *   }} An object containing the observed values, a ref to the observed element.
 */
export const useResizeObserver = <T extends HTMLDivElement>(
  properties: DOMRectKeys[],
  dependencies: React.DependencyList = [],
  options: UseResizeObserverOptions = {}
): {
  values: number[]
  elementRef: MutableRefObject<T | null>
} => {
  const { debounceMs = 0 } = options
  const elementRef = useRef<T | null>(null)
  const [values, setValues] = useState<number[]>([])
  /**
   * Gets the current values of the specified DOMRect properties.
   *
   * @returns The current numeric values of the specified properties.
   */
  const getValues = useCallback((): number[] => {
    if (!elementRef.current) {
      return []
    }

    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
    const rect = elementRef.current.getBoundingClientRect()

    return properties.map(property => {
      return rect[property]
    })
  }, [properties])

  useEffect(() => {
    if (!elementRef.current) {
      return
    }

    setValues(getValues())

    let frameId: number
    let debounceTimeoutId: ReturnType<typeof setTimeout>

    const updateValues = (): void => {
      frameId = window.requestAnimationFrame(() => {
        setValues(getValues())
      })
    }

    const observer = new ResizeObserver(() => {
      if (debounceMs > 0) {
        // Debounce: wait for resize events to settle before updating
        clearTimeout(debounceTimeoutId)
        debounceTimeoutId = setTimeout(updateValues, debounceMs)
      } else {
        // No debouncing, just use requestAnimationFrame batching
        updateValues()
      }
    })

    observer.observe(elementRef.current)

    return () => {
      observer.disconnect()
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: Update to match React best practices
  }, [properties, getValues, debounceMs, ...dependencies])

  return { values, elementRef }
}
