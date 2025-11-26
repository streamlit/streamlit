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
 * When no dimension is detected, it returns a fallback value (default: -1), that can be used
 * to detect when dimensions aren't ready and avoid visual flickering that might occur during initial rendering.
 * The fallback value can be configured to match the requirements of the component that uses it.
 *
 * @template T - The type of HTML element being observed (defaults to HTMLDivElement)
 *
 * @param {React.DependencyList} [dependencies=[]] - An optional list of dependencies
 * that will cause the observer to be re-evaluated.
 * @param {number} [fallbackValue=-1] - The value to return when width or height is 0.
 * The default value is -1 which allows components to detect when dimensions aren't ready.
 *
 * @returns An object containing:
 *   - width: The current width of the observed element in pixels (or fallbackValue if width is 0)
 *   - height: The current height of the observed element in pixels (or fallbackValue if height is 0)
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
 *
 * @example
 * ```tsx
 * // For Vega-Lite charts that need non-negative dimensions
 * const VegaChart = () => {
 *   const { width, height, elementRef } = useCalculatedDimensions([], 0);
 *   // width and height will be 0 instead of -1 when not ready
 * };
 * ```
 */
export const useCalculatedDimensions = <T extends HTMLDivElement>(
  dependencies: React.DependencyList = [],
  fallbackValue: number = -1
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

  return {
    width: width || fallbackValue,
    height: height || fallbackValue,
    elementRef,
  }
}
