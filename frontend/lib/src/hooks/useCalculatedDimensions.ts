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

import { MutableRefObject, useMemo } from "react"

import { useDebouncedValue } from "./useDebouncedValue"
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
 * @param {number} [debounceMs=16] - Debounce delay in milliseconds for dimension updates.
 * Defaults to 16ms (one frame at 60fps) to batch rapid ResizeObserver updates while remaining
 * imperceptible to users, improving performance and reducing layout thrashing.
 * Set to 0 to disable debouncing.
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
 *
 * @example
 * ```tsx
 * // For charts that need custom debouncing (default is 16ms)
 * const PlotlyChart = () => {
 *   const { width, height, elementRef } = useCalculatedDimensions([], -1, 100);
 *   // width and height will be debounced by 100ms instead of the default 16ms
 * };
 * ```
 *
 * @example
 * ```tsx
 * // To disable debouncing entirely
 * const FastUpdateChart = () => {
 *   const { width, height, elementRef } = useCalculatedDimensions([], -1, 0);
 *   // width and height will update immediately without debouncing
 * };
 * ```
 */
export const useCalculatedDimensions = <T extends HTMLDivElement>(
  dependencies: React.DependencyList = [],
  fallbackValue: number = -1,
  debounceMs: number = 16
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

  const rawWidth = width || fallbackValue
  const rawHeight = height || fallbackValue

  // Apply debouncing to batch rapid ResizeObserver updates
  // Default 16ms aligns with 60fps frame rate for optimal performance
  const debouncedWidth = useDebouncedValue(rawWidth, debounceMs)
  const debouncedHeight = useDebouncedValue(rawHeight, debounceMs)

  return {
    width: debounceMs > 0 ? debouncedWidth : rawWidth,
    height: debounceMs > 0 ? debouncedHeight : rawHeight,
    elementRef,
  }
}
