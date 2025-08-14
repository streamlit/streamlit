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

/**
 * A hook that observes changes to the dimensions of a DOM element.
 *
 * @template T - The type of the HTML element being observed.
 * @param {DOMRectKeys[]} properties - The list of DOMRect properties to observe.
 * @param {React.DependencyList} [dependencies=[]] - An optional list of dependencies
 * that will cause the observer to be re-evaluated.
 * @returns {{
 *   values: number[],
 *   elementRef: MutableRefObject<T | null>,
 *   }} An object containing the observed values, a ref to the observed element.
 */
export const useResizeObserver = <T extends HTMLDivElement>(
  properties: DOMRectKeys[],
  dependencies: React.DependencyList = []
): {
  values: number[]
  elementRef: MutableRefObject<T | null>
} => {
  const elementRef = useRef<T | null>(null)
  const [values, setValues] = useState<number[]>([])
  /**
   * Gets the current values of the specified DOMRect properties.
   *
   * @returns {DOMRectKeys[]} The current values of the specified properties.
   */
  const getValues = useCallback(() => {
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
    const observer = new ResizeObserver(() => {
      frameId = window.requestAnimationFrame(() => {
        setValues(getValues())
      })
    })

    observer.observe(elementRef.current)

    return () => {
      observer.disconnect()
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
    }
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, getValues, ...dependencies])

  return { values, elementRef }
}
