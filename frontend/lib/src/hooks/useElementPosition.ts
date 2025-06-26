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

import { useState, RefObject, useCallback, useEffect } from "react"

export interface ElementPosition {
  top: number
  left: number
  width: number
  height: number
}

/**
 * Custom hook that returns the position of a DOM element.
 *
 * @param elementRef - A ref to the element.
 *
 * @returns The position of the element, or undefined if the element is not yet available.
 */
export function useElementPosition(
  elementRef: RefObject<HTMLElement>
): ElementPosition | undefined {
  const [position, setPosition] = useState<ElementPosition | undefined>(
    undefined
  )

  const updatePosition = useCallback(() => {
    if (elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect()
      setPosition({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }
  }, [elementRef])

  useEffect(() => {
    // We want to set the position immediately on mount.
    updatePosition()

    // We also use a MutationObserver to detect when the element's position
    // might have changed due to other elements being added or removed.
    const observer = new MutationObserver(updatePosition)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true, // For changes that might affect layout
    })

    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("resize", updatePosition)
      observer.disconnect()
    }
  }, [updatePosition])

  return position
}
