/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { useCallback, useContext, useEffect, useMemo, useState } from "react"

import { LibContext } from "@streamlit/lib/src/components/core/LibContext"
import { WindowDimensionsContext } from "@streamlit/lib/src/components/shared/WindowDimensions"
import { useRequiredContext } from "@streamlit/lib/src/hooks/useRequiredContext"

export type UseEscapeToCollapseArgs = {
  expanded: boolean
  zoomOut: () => void
}

export type UseFullscreenShape = {
  expanded: boolean
  fullHeight: number
  fullWidth: number
  zoomIn: () => void
  zoomOut: () => void
}

export const useFullscreen = (): UseFullscreenShape => {
  const { setFullScreen } = useContext(LibContext)
  const [expanded, setExpanded] = useState(false)
  const { fullHeight, fullWidth } = useRequiredContext(WindowDimensionsContext)

  const setExpandedState = useCallback(
    (isExpanded: boolean) => {
      // Set the local component-level state
      setExpanded(isExpanded)
      // Set the context-level state
      setFullScreen(isExpanded)
    },
    [setFullScreen]
  )

  const zoomIn = useCallback(() => {
    document.body.style.overflow = "hidden"
    setExpandedState(true)
  }, [setExpandedState])

  const zoomOut = useCallback(() => {
    document.body.style.overflow = "unset"
    setExpandedState(false)
  }, [setExpandedState])

  const controlKeys = useCallback(
    (event: KeyboardEvent) => {
      /**
       * keyCode 27 is the ESC key
       * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
       */
      if (event.keyCode === 27 && expanded) {
        // Exit fullscreen
        zoomOut()
      }
    },
    [zoomOut, expanded]
  )

  useEffect(() => {
    document.addEventListener("keydown", controlKeys, false)

    return () => {
      document.removeEventListener("keydown", controlKeys, false)
    }
  }, [controlKeys])

  return useMemo(() => {
    return { expanded, zoomIn, zoomOut, fullHeight, fullWidth }
  }, [expanded, zoomIn, zoomOut, fullHeight, fullWidth])
}
