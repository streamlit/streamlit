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

import React, { FC, memo } from "react"

import { FullscreenEnter, FullscreenExit } from "@emotion-icons/open-iconic"

import Icon from "@streamlit/lib/src/components/shared/Icon"
import { useFullscreen } from "@streamlit/lib/src/components/shared/ElementFullscreen/useFullscreen"

import {
  StyledFullScreenButton,
  StyledFullScreenFrame,
} from "./styled-components"

export type Size = {
  width: number
  expanded: boolean
  height?: number
  expand: () => void
  collapse: () => void
}

/**
 * Function responsible for rendering children.
 * This function should implement the following signature:
 * ({ height, width }) => PropTypes.element
 */
export interface FullScreenWrapperProps {
  children: (props: Size) => React.ReactNode
  width: number
  height?: number
  disableFullscreenMode?: boolean
}

/**
 * @deprecated Utilize `ElementFullscreenWrapper` instead
 *
 * A component that draws a button on the top right of the
 * wrapper element. OnClick, change the element container
 * to fixed and cover all screen, updating wrapped element height and width
 */
const FullScreenWrapper: FC<FullScreenWrapperProps> = ({
  children,
  width,
  height,
  disableFullscreenMode,
}) => {
  const { expanded, fullHeight, fullWidth, zoomIn, zoomOut } = useFullscreen()

  let buttonImage = FullscreenEnter
  let buttonOnClick = zoomIn
  let buttonTitle = "View fullscreen"

  if (expanded) {
    buttonImage = FullscreenExit
    buttonOnClick = zoomOut
    buttonTitle = "Exit fullscreen"
  }

  return (
    <StyledFullScreenFrame
      isExpanded={expanded}
      data-testid="stFullScreenFrame"
    >
      {!disableFullscreenMode && (
        <StyledFullScreenButton
          data-testid="StyledFullScreenButton"
          onClick={buttonOnClick}
          title={buttonTitle}
          isExpanded={expanded}
        >
          <Icon content={buttonImage} />
        </StyledFullScreenButton>
      )}
      {children({
        width: expanded ? fullWidth : width,
        height: expanded ? fullHeight : height,
        expanded,
        expand: zoomIn,
        collapse: zoomOut,
      })}
    </StyledFullScreenFrame>
  )
}

export default memo(FullScreenWrapper)
