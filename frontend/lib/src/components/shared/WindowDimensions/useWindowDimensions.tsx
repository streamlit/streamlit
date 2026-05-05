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

import { useCallback, useEffect, useLayoutEffect, useState } from "react"

import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useThrottledCallback } from "~lib/hooks/useThrottledCallback"
import { convertRemToPx } from "~lib/theme/utils"

/**
 * Throttle delay for window resize events in milliseconds.
 * This limits re-renders during active window resizing while still
 * providing periodic updates.
 */
const RESIZE_THROTTLE_MS = 100

export type WindowDimensions = {
  fullWidth: number
  fullHeight: number
  innerWidth: number
  innerHeight: number
}

export const useWindowDimensions = (): WindowDimensions => {
  const theme = useEmotionTheme()
  const [windowDimensions, setWindowDimensions] = useState<WindowDimensions>({
    fullWidth: 0,
    fullHeight: 0,
    innerWidth: 0,
    innerHeight: 0,
  })

  const getWindowDimensions = useCallback((): WindowDimensions => {
    const padding = convertRemToPx(theme.spacing.md)
    const paddingTop = convertRemToPx(theme.sizes.fullScreenHeaderHeight)

    // eslint-disable-next-line no-restricted-properties, streamlit-custom/no-force-reflow-access -- The only expected usage of window.{innerWidth,innerHeight}
    const { innerWidth, innerHeight } = window

    return {
      fullWidth: innerWidth - padding * 2, // Left and right
      fullHeight: innerHeight - (padding + paddingTop), // Bottom and Top
      innerWidth,
      innerHeight,
    }
  }, [theme.sizes.fullScreenHeaderHeight, theme.spacing.md])

  const updateWindowDimensions = useCallback(() => {
    setWindowDimensions(getWindowDimensions())
  }, [getWindowDimensions])

  const { throttledCallback: throttledResize, cancel: cancelThrottle } =
    useThrottledCallback(updateWindowDimensions, RESIZE_THROTTLE_MS)

  useEffect(() => {
    window.addEventListener("resize", throttledResize)

    return () => {
      window.removeEventListener("resize", throttledResize)
      cancelThrottle()
    }
  }, [throttledResize, cancelThrottle])

  useLayoutEffect(() => {
    // Measure once on load, let resize handlers take over from there

    updateWindowDimensions()
  }, [updateWindowDimensions])

  return windowDimensions
}
