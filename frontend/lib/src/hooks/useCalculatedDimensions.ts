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

import { MutableRefObject, useMemo } from "react"

import { useResizeObserver } from "./useResizeObserver"

/**
 * A React hook that observes and returns the width and/or height of a DOM element.
 *
 * This hook uses a ResizeObserver to track changes to an element's dimensions in real-time.
 * It returns -1 instead of 0 when no dimension is detected to prevent visual flickering
 * that might occur during initial rendering or when elements are temporarily hidden.
 *
 * @template T - The type of HTML element being observed (defaults to HTMLDivElement)
 *
 * @param {React.DependencyList} [dependencies=[]] - An optional list of dependencies
 * that will cause the observer to be re-evaluated.
 *
 * @returns An object containing:
 *   - width: The current width of the observed element in pixels (or -1 if width is 0)
 *   - height: The current height of the observed element in pixels (or -1 if height is 0)
 *   - elementRef: A ref object that should be attached to the element you want to observe
 *
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const { width, height, elementRef } = useCalculatedDimensions();
 *
 *   return (
 *     <div ref={elementRef}>
 *       Current dimensions: {width === -1 ? 'calculating...' : `${width}px`} x {height === -1 ? 'calculating...' : `${height}px`}
 *     </div>
 *   );
 * };
 * ```
 */
export const useCalculatedDimensions = <T extends HTMLDivElement>(
  dependencies: React.DependencyList = []
): {
  width: number
  height: number
  elementRef: MutableRefObject<T | null>
} => {
  const {
    values: [width, height],
    elementRef,
  } = useResizeObserver<T>(
    useMemo(() => ["width", "height"], []),
    dependencies
  )

  return { width: width || -1, height: height || -1, elementRef }
}
