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

import { useMemo } from "react"

/**
 * Determines the width and height to use for a given element based on the
 * Streamlit conditions in which it's being rendered.
 *
 * @returns {Object} An object with `width` and `height` properties.
 */
export const useStWidthHeight = ({
  container,
  element,
  heightFallback = "auto",
  isFullScreen,
  shouldUseContainerWidth,
  widthFallback = "auto",
}: {
  container: {
    height?: number | string
    width?: number | string
  }
  element: {
    height?: number | string
    width?: number | string
  }
  heightFallback?: number | string
  isFullScreen: boolean
  shouldUseContainerWidth: boolean
  widthFallback?: number | string
}): { height: number | string; width: number | string } => {
  const width = useMemo(() => {
    if (shouldUseContainerWidth || isFullScreen) {
      return "100%"
    }
    return element.width || container.width || widthFallback
  }, [
    container.width,
    element.width,
    isFullScreen,
    shouldUseContainerWidth,
    widthFallback,
  ])

  const height = useMemo(() => {
    if (isFullScreen && container.height) {
      return container.height
    }

    return element.height || container.height || heightFallback
  }, [isFullScreen, element.height, container.height, heightFallback])

  return { width, height }
}
