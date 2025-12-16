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

import { useCallback, useEffect, useRef, useState } from "react"

import { OnSelectProps } from "react-json-view"

/**
 * The state of the JSON tooltip.
 */
export interface TooltipState {
  // The path to the JSON element.
  path: string
  // The x position of the tooltip.
  x: number
  // The y position of the tooltip.
  y: number
}

export interface UseJsonTooltipResult {
  // The current tooltip state, or null if no tooltip is visible.
  tooltip: TooltipState | null
  // The function to handle the selection of a JSON element.
  handleSelect: (select: OnSelectProps) => void
  // The function to clear the tooltip.
  clearTooltip: () => void
}

/**
 * Converts a namespace array from react-json-view into a JSON path string.
 * Handles both object keys and array indices.
 */
export function formatJsonPath(namespace: Array<string | null>): string {
  if (namespace.length === 0) {
    return "$"
  }

  return namespace.reduce<string>((path, key, index) => {
    if (key === null) {
      return path
    }
    // Check if key is a numeric array index
    const isArrayIndex = /^\d+$/.test(key)
    if (isArrayIndex) {
      return `${path}[${key}]`
    }
    // Check if key needs bracket notation (empty, contains special chars, or starts with number)
    const needsBrackets =
      key === "" || /[^a-zA-Z0-9_$]/.test(key) || /^\d/.test(key)
    if (needsBrackets) {
      // Escape backslashes first, then double quotes
      const escaped = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      return `${path}["${escaped}"]`
    }
    // Use dot notation
    return index === 0 || path === "" ? key : `${path}.${key}`
  }, "")
}

/**
 * Custom hook to manage JSON path tooltip state and interactions.
 * Used with react-json-view to show a copyable path when selecting JSON elements.
 */
export function useJsonTooltip(): UseJsonTooltipResult {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const lastMousePosition = useRef({ x: 0, y: 0 })

  // Track mouse position on mousedown to capture click coordinates.
  // This avoids using the deprecated window.event.
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent): void => {
      lastMousePosition.current = { x: e.clientX, y: e.clientY }
    }

    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  const handleSelect = useCallback((select: OnSelectProps): void => {
    const { x, y } = lastMousePosition.current

    // namespace contains the path to the parent, we need to add the current key (name)
    const fullNamespace = [...select.namespace, select.name]
    const path = formatJsonPath(fullNamespace)

    setTooltip({ path, x, y })
  }, [])

  const clearTooltip = useCallback((): void => {
    setTooltip(null)
  }, [])

  return { tooltip, handleSelect, clearTooltip }
}
