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

import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"

const blink = keyframes`
  50% {
    color: rgba(0, 0, 0, 0);
  }
`

export interface StyledMessageProps {
  includeDot: boolean
  shouldBlink: boolean
}

export const StyledMessage = styled.span<StyledMessageProps>(
  ({ includeDot, shouldBlink, theme }) => ({
    ...(includeDot
      ? {
          "&::before": {
            opacity: 1,
            content: '"•"',
            animation: "none",
            color: theme.colors.gray,
            margin: `0 ${theme.spacing.twoXS}`,
          },
        }
      : {}),
    ...(shouldBlink
      ? {
          color: theme.colors.red,
          animationName: `${blink}`,
          animationDuration: "0.5s",
          animationIterationCount: 5,
        }
      : {}),
  })
)
