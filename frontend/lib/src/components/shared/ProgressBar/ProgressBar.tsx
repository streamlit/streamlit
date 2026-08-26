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

import { ReactElement } from "react"

import { ProgressBar as AriaProgressBar } from "react-aria-components"

import { StyledProgressFill, StyledProgressTrack } from "./styled-components"
import { Size } from "./types"

export { Size }

interface ProgressBarProps {
  value: number
  size?: Size
  squareTopCorners?: boolean
  /** Accessible label for the progress indicator. */
  "aria-label"?: string
}

function ProgressBar({
  value,
  size = Size.SMALL,
  squareTopCorners = false,
  "aria-label": ariaLabel = "progress",
}: ProgressBarProps): ReactElement {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <AriaProgressBar
      value={clamped}
      minValue={0}
      maxValue={100}
      aria-label={ariaLabel}
    >
      <StyledProgressTrack
        $size={size}
        data-testid="stProgressBarTrack"
        style={
          squareTopCorners
            ? { borderTopLeftRadius: "0", borderTopRightRadius: "0" }
            : undefined
        }
      >
        <StyledProgressFill
          style={{ transform: `translateX(${clamped - 100}%)` }}
        />
      </StyledProgressTrack>
    </AriaProgressBar>
  )
}

export default ProgressBar
