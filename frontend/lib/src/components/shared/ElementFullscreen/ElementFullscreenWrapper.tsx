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

import React, { FC, PropsWithChildren, useMemo } from "react"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import { StyledFullScreenFrame } from "~lib/components/shared/FullScreenWrapper/styled-components"
import { useCalculatedWidth } from "~lib/hooks/useCalculatedWidth"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import { useFullscreen } from "./useFullscreen"

type ElementFullscreenWrapperProps = PropsWithChildren<{
  height?: number
  width?: number
}>

const ElementFullscreenWrapper: FC<ElementFullscreenWrapperProps> = ({
  children,
  height,
}) => {
  const theme = useEmotionTheme()
  const { expanded, fullHeight, fullWidth, zoomIn, zoomOut } = useFullscreen()
  const [width, elementRef] = useCalculatedWidth()

  const fullscreenContextValue = useMemo(() => {
    return {
      width: expanded ? fullWidth : width,
      height: expanded ? fullHeight : height,
      expanded,
      expand: zoomIn,
      collapse: zoomOut,
    }
  }, [expanded, fullHeight, fullWidth, height, width, zoomIn, zoomOut])

  return (
    <ElementFullscreenContext.Provider value={fullscreenContextValue}>
      <StyledFullScreenFrame
        ref={elementRef}
        isExpanded={expanded}
        data-testid="stFullScreenFrame"
        theme={theme}
      >
        {children}
      </StyledFullScreenFrame>
    </ElementFullscreenContext.Provider>
  )
}

export default ElementFullscreenWrapper
