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

import { useMemo } from "react"

export const measureScrollbarGutterSize = (): number => {
  // Create a temporary div to measure scrollbar gutter size
  const outer = document.createElement("div")
  outer.style.position = "absolute"
  outer.style.top = "-9999px" // Move it off-screen
  outer.style.left = "-9999px"
  outer.style.visibility = "hidden"
  outer.style.overflow = "scroll" // Triggers scrollbar
  outer.style.width = "50px" // Give it a fixed size to ensure overflow
  outer.style.height = "50px" // Give it a fixed size to ensure overflow
  document.body.appendChild(outer)

  // Create an inner div to measure content width
  const inner = document.createElement("div")
  inner.style.width = "100%" // Inner div takes full width of outer's content area
  inner.style.height = "100%"
  outer.appendChild(inner)

  // Calculate the scrollbar gutter size
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
  const calculatedWidth = outer.offsetWidth - inner.offsetWidth

  // Remove the temporary divs
  outer.remove()

  return calculatedWidth
}
/**
 * React hook to measure the scrollbar gutter size (in pixels).
 *
 * This will return 0 if the OS/browser has activated overlay scrollbars.
 */
export const useScrollbarGutterSize = (): number => {
  const devicePixelRatio = window.devicePixelRatio

  const scrollbarGutterWidth = useMemo(() => {
    return measureScrollbarGutterSize()
    // We want this to recalculate when the devicePixelRatio has changed.
    // This doesn't ensure that its recalculated whenever window.devicePixelRatio
    // changes, but that seems like good enough for now.
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devicePixelRatio])
  return scrollbarGutterWidth
}
