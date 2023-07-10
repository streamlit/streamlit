/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"

const IMAGE_HEIGHT = 300
const IMAGE_WIDTH = 121
const POS_MIN_VW = 20
const POS_MAX_VW = 80
const DELAY_MAX_MS = 1000

const moveUp = keyframes`
  from {
    transform: translateY(calc(100vh + ${IMAGE_HEIGHT}px));
  }

  to {
    transform: translateY(0);
  }
`

export const StyledBalloon = styled.img(({ theme }) => ({
  position: "fixed",
  top: `${-IMAGE_HEIGHT}px`,
  marginLeft: `${-IMAGE_WIDTH / 2}px`,
  zIndex: theme.zIndices.balloons,
  left: `${Math.random() * (POS_MAX_VW - POS_MIN_VW) + POS_MIN_VW}vw`,
  animationDelay: `${Math.random() * DELAY_MAX_MS}ms`,
  height: `${IMAGE_HEIGHT}px`,
  width: `${IMAGE_WIDTH}px`,
  pointerEvents: "none",

  animationDuration: "750ms",
  animationName: moveUp,
  animationTimingFunction: "ease-in",
  animationDirection: "normal",
  animationIterationCount: 1,
  opacity: 1,
}))
