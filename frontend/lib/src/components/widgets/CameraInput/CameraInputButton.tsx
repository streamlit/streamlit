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

import React, { MouseEvent, ReactElement, ReactNode } from "react"

import ProgressBar, {
  Size as ProgressBarSize,
} from "@streamlit/lib/src/components/shared/ProgressBar"

import {
  StyledCameraInputBaseButton,
  StyledProgressBar,
} from "./styled-components"

export interface CameraInputButtonProps {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => any
  disabled?: boolean
  progress?: number | null
  children?: ReactNode
}

function CameraInputButton({
  disabled,
  onClick,
  children,
  progress,
}: CameraInputButtonProps): ReactElement {
  return (
    <StyledCameraInputBaseButton
      disabled={disabled || false}
      onClick={onClick || (() => {})}
      progress={progress || null}
      data-testid="stCameraInputButton"
    >
      {children}
      {progress && (
        <StyledProgressBar>
          <ProgressBar
            value={progress}
            size={ProgressBarSize.EXTRASMALL}
            overrides={{
              Bar: {
                style: {
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                },
              },
              BarProgress: {
                style: {
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                },
              },
              BarContainer: {
                style: {
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                },
              },
            }}
          />
        </StyledProgressBar>
      )}
    </StyledCameraInputBaseButton>
  )
}

export default CameraInputButton
